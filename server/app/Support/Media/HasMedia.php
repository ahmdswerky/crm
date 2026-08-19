<?php

namespace App\Support\Media;

use Spatie\Image\Enums\Fit;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

trait HasMedia
{
    use InteractsWithMedia;

    public function registerMediaCollections(): void
    {
        if ($this->usesMediaTrait(HasGallery::class)) {
            $this->addMediaCollection('gallery')
                ->useDisk(config('media-library.disk_name'))
                ->acceptsMimeTypes(config('media-library.image_mime_types'));
        }

        if ($this->usesMediaTrait(HasMain::class)) {
            $this->addMediaCollection('main')
                ->useDisk(config('media-library.disk_name'))
                ->singleFile()
                ->acceptsMimeTypes(config('media-library.image_mime_types'));
        }
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        if ($this->usesMediaTrait(HasGallery::class) && ($media === null || $media->collection_name === 'gallery')) {
            $this->addMediaConversion('gallery-thumbnail')
                ->fit(Fit::Crop, 480, 360)
                ->format('webp')
                ->performOnCollections('gallery');

            $this->addMediaConversion('gallery-display')
                ->fit(Fit::Contain, 1600, 1200)
                ->format('webp')
                ->performOnCollections('gallery');
        }

        if ($this->usesMediaTrait(HasMain::class) && ($media === null || $media->collection_name === 'main')) {
            $this->addMediaConversion('main-thumbnail')
                ->fit(Fit::Crop, 256, 256)
                ->format('webp')
                ->performOnCollections('main');
        }
    }

    private function usesMediaTrait(string $trait): bool
    {
        return in_array($trait, class_uses_recursive($this), true);
    }
}
