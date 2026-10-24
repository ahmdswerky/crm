<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Spatie\Image\Image;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Throwable;

class MediaService
{
    public function __construct(private readonly AuditEventLogger $auditEvents) {}

    /**
     * @param  array<int, UploadedFile>  $images
     * @return Collection<int, Media>
     */
    public function attach(Model&HasMedia $model, array $images, string $collection, User $uploadedBy): Collection
    {
        $uploadLimit = config("media-library.collection_upload_limits.{$collection}");
        $limit = config("media-library.collection_limits.{$collection}");
        $seedPlaceholders = $model->getMedia($collection)
            ->filter(fn (Media $media): bool => $media->getCustomProperty('seed_placeholder') === true);
        $existingMediaCount = $model->getMedia($collection)->count() - $seedPlaceholders->count();

        if (is_int($uploadLimit) && count($images) > $uploadLimit) {
            throw ValidationException::withMessages([
                'files' => [sprintf('This collection accepts at most %d files per upload.', $uploadLimit)],
            ]);
        }

        if (is_int($limit) && $existingMediaCount + count($images) > $limit) {
            throw ValidationException::withMessages([
                'files' => [sprintf('This collection can have at most %d files.', $limit)],
            ]);
        }

        // Re-encode every file before storing any, so one bad file rejects the whole batch.
        $sanitized = $this->sanitize($images);

        $seedPlaceholders->each->delete();

        return collect($images)->map(function (UploadedFile $image, int $index) use ($collection, $model, $sanitized, $uploadedBy): Media {
            $media = $model
                ->addMedia($sanitized[$index])
                ->usingName($this->displayName($image))
                ->usingFileName($this->fileName($image))
                ->withCustomProperties([
                    'uploaded_by' => $uploadedBy->getKey(),
                ])
                ->toMediaCollection($collection);

            $this->auditEvents->mediaUploaded($model, $media, $uploadedBy);

            return $media;
        });
    }

    public function delete(Model&HasMedia $model, Media $media, string $collection, User $deletedBy): void
    {
        $this->ensureBelongsTo($model, $media, $collection);

        $this->auditEvents->mediaDeleted($model, $media, $deletedBy);
        $media->delete();
    }

    /**
     * @param  array<int, int>  $mediaIds
     */
    public function reorder(Model&HasMedia $model, array $mediaIds, string $collection, User $reorderedBy): void
    {
        $currentIds = $model->getMedia($collection)->pluck('id')->map(fn (int $id) => (int) $id)->sort()->values()->all();
        $requestedIds = collect($mediaIds)->map(fn (int $id) => (int) $id)->sort()->values()->all();

        if ($currentIds !== $requestedIds) {
            throw ValidationException::withMessages([
                'media_ids' => ['The media order must contain every item in this collection exactly once.'],
            ]);
        }

        Media::setNewOrder($mediaIds);
        $this->auditEvents->mediaReordered($model, $mediaIds, $collection, $reorderedBy);
    }

    private function ensureBelongsTo(Model&HasMedia $model, Media $media, string $collection): void
    {
        if (
            $media->model_type !== $model->getMorphClass()
            || (string) $media->model_id !== (string) $model->getKey()
            || $media->collection_name !== $collection
        ) {
            abort(404);
        }
    }

    /**
     * Decode each upload and re-encode it as webp. Rejects corrupt files and drops
     * EXIF metadata and any bytes smuggled after the image data.
     *
     * @param  array<int, UploadedFile>  $images
     * @return array<int, string>
     */
    private function sanitize(array $images): array
    {
        $paths = [];

        foreach ($images as $index => $image) {
            $path = tempnam(sys_get_temp_dir(), 'media');

            try {
                Image::useImageDriver(config('media-library.image_driver'))
                    ->loadFile($image->getRealPath())
                    ->format('webp')
                    ->save($path);
                $paths[$index] = $path;
            } catch (Throwable) {
                array_map(unlink(...), [...$paths, $path]);

                throw ValidationException::withMessages([
                    "files.{$index}" => ['The file is corrupted or not a valid image.'],
                ]);
            }
        }

        return $paths;
    }

    private function displayName(UploadedFile $image): string
    {
        return Str::of(pathinfo($image->getClientOriginalName(), PATHINFO_FILENAME))
            ->squish()
            ->limit(100, '')
            ->toString();
    }

    private function fileName(UploadedFile $image): string
    {
        $baseName = Str::slug(pathinfo($image->getClientOriginalName(), PATHINFO_FILENAME));

        return sprintf('%s.webp', $baseName ?: 'image');
    }
}
