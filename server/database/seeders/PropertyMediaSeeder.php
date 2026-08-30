<?php

namespace Database\Seeders;

use App\Models\Property;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use SplFileInfo;

class PropertyMediaSeeder extends Seeder
{
    public function run(): void
    {
	return;
        $this->syncExistingSeedMedia();

        $imageSets = $this->imageSets();

        if ($imageSets === []) {
            throw new RuntimeException('No supported property seed images were found.');
        }

        $batchCount = (int) config('crm.seeds.counts')['property_media'];
        $maxTotal = (int) config('crm.seeds.max_counts')['property_media'];
        $existingCount = Property::query()
            ->whereHas('media', fn ($query) => $query->where('collection_name', 'gallery'))
            ->count();
        $count = min($batchCount, max($maxTotal - $existingCount, 0));

        if (! $count) {
            return;
        }

        $properties = Property::query()
            ->whereDoesntHave('media', fn ($query) => $query->where('collection_name', 'gallery'));
        $propertyIds = $properties->limit($count)->pluck('id');
        $count = $propertyIds->count();

        if (! $count) {
            return;
        }

        $progressBar = $this->command->getOutput()->createProgressBar($count);
        $progressBar->setFormat(' %current%/%max% [%bar%] %percent:3s%%');
        $progressBar->start();

        Property::query()
            ->whereKey($propertyIds)
            ->lazyById()
            ->each(function (Property $property) use ($imageSets, $progressBar): void {
                $images = $imageSets[array_rand($imageSets)];
                shuffle($images);

                if (config('crm.seeds.shared_property_images', true)) {
                    $this->createSeedMedia($property, $images);
                } else {
                    foreach ($images as $image) {
                        $property
                            ->addMedia($image->getPathname())
                            ->preservingOriginal()
                            ->toMediaCollection('gallery');
                    }
                }

                $progressBar->advance();
            });

        $progressBar->finish();
        $progressBar->clear();

        $this->command->outputComponents()->success("  {$count} property image sets generated successfully.");
    }

    /** @param array<int, SplFileInfo> $images */
    private function createSeedMedia(Property $property, array $images): void
    {
        foreach ($images as $order => $image) {
            $seedImagePath = 'seed-images/properties/'.basename($image->getPath()).'/'.$image->getFilename();
            $disk = config('media-library.disk_name');

            if (! Storage::disk($disk)->put($seedImagePath, File::get($image->getPathname()))) {
                throw new RuntimeException("Unable to copy the seed image into the {$disk} disk: {$seedImagePath}");
            }

            Media::query()->create([
                'model_type' => $property->getMorphClass(),
                'model_id' => $property->getKey(),
                'uuid' => (string) Str::uuid(),
                'collection_name' => 'gallery',
                'name' => pathinfo($image->getFilename(), PATHINFO_FILENAME),
                'file_name' => $image->getFilename(),
                'mime_type' => File::mimeType($image->getPathname()),
                'disk' => config('media-library.disk_name'),
                'conversions_disk' => config('media-library.conversions_disk_name'),
                'size' => $image->getSize(),
                'manipulations' => [],
                'custom_properties' => [
                    'seed_placeholder' => true,
                    'seed_image_path' => $seedImagePath,
                ],
                'generated_conversions' => [],
                'responsive_images' => [],
                'order_column' => $order + 1,
            ]);
        }
    }

    private function syncExistingSeedMedia(): void
    {
        Media::query()
            ->whereJsonContains('custom_properties->seed_placeholder', true)
            ->lazyById()
            ->each(function (Media $media): void {
                $seedImagePath = $media->getCustomProperty('seed_image_path');

                if (! is_string($seedImagePath)) {
                    return;
                }

                $disk = $media->disk ?: config('media-library.disk_name');

                if (Storage::disk($disk)->exists($seedImagePath)) {
                    return;
                }

                $sourcePath = public_path($seedImagePath);

                if (! File::isFile($sourcePath)) {
                    throw new RuntimeException("The seed image is missing: {$sourcePath}");
                }

                if (! Storage::disk($disk)->put($seedImagePath, File::get($sourcePath))) {
                    throw new RuntimeException("Unable to copy the seed image into the {$disk} disk: {$seedImagePath}");
                }
            });
    }

    /** @return array<int, array<int, SplFileInfo>> */
    private function imageSets(): array
    {
        $allowedExtensions = config('media-library.allowed_extensions', []);

        return collect(File::directories(public_path('seed-images/properties')))
            ->map(fn (string $directory): array => collect(File::files($directory))
                ->filter(fn (SplFileInfo $file): bool => in_array(
                    strtolower($file->getExtension()),
                    $allowedExtensions,
                    true,
                ))
                ->values()
                ->all())
            ->filter()
            ->values()
            ->all();
    }
}
