<?php

namespace Database\Seeders;

use App\Models\Property;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;
use RuntimeException;
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
            ->lazyById()
            ->each(function (Property $property) use ($imageSets): void {
                $images = $imageSets[array_rand($imageSets)];
                shuffle($images);

                foreach ($images as $image) {
                    $property
                        ->addMedia($image)
                        ->preservingOriginal()
                        ->toMediaCollection('gallery');
                }
            });
    }

    /** @return array<int, array<int, string>> */
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
                ->map(fn (SplFileInfo $file): string => $file->getPathname())
                ->values()
                ->all())
            ->filter()
            ->values()
            ->all();
    }
}
