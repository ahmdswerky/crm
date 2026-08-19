<?php

namespace Database\Seeders;

use App\Models\Property;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use RuntimeException;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use SplFileInfo;

class PropertyMediaSeeder extends Seeder
{
    public function run(): void
    {
        $imageSets = $this->imageSets();

        if ($imageSets === []) {
            throw new RuntimeException('No supported property seed images were found.');
        }

        Property::query()
            ->whereDoesntHave('media', fn ($query) => $query->where('collection_name', 'gallery'))
            ->lazyById()
            ->each(function (Property $property) use ($imageSets): void {
                $images = $imageSets[array_rand($imageSets)];
                shuffle($images);

                if (config('crm.seeds.shared_property_images', true)) {
                    $this->createSeedMedia($property, $images);

                    return;
                }

                foreach ($images as $image) {
                    $property
                        ->addMedia($image->getPathname())
                        ->preservingOriginal()
                        ->toMediaCollection('gallery');
                }
            });
    }

    /** @param array<int, SplFileInfo> $images */
    private function createSeedMedia(Property $property, array $images): void
    {
        foreach ($images as $order => $image) {
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
                    'seed_image_path' => 'seed-images/properties/'.basename($image->getPath()).'/'.$image->getFilename(),
                ],
                'generated_conversions' => [],
                'responsive_images' => [],
                'order_column' => $order + 1,
            ]);
        }
    }

    /** @return array<int, array<int, SplFileInfo>> */
    private function imageSets(): array
    {
        $allowedExtensions = config('media-library.allowed_extensions', []);

        return collect(File::directories(public_path('seed-images')))
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
