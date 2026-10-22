<?php

use App\Http\Resources\MediaResource;
use App\Models\Property;
use Database\Seeders\PropertyMediaSeeder;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Spatie\MediaLibrary\Conversions\Jobs\PerformConversionsJob;

beforeEach(function () {
    config(['media-library.queue_conversions_after_database_commit' => false]);
    Queue::fake();
    Storage::fake('public');
});

test('it assigns one complete random shared seed-image set to each existing property', function () {
    $properties = Property::factory(2)->create();
    $sourceImages = collect(glob(public_path('seed-images/properties/*/*')));

    $this->seed(PropertyMediaSeeder::class);

    $properties->each(function (Property $property) use ($sourceImages): void {
        $media = $property->fresh()->getMedia('gallery');

        expect($media->count())->toBeIn([3, 4, 7]);

        $media->each(function ($item) use ($sourceImages): void {
            $seedImagePath = $item->getCustomProperty('seed_image_path');
            $sourceImage = public_path($seedImagePath);

            expect($sourceImages)->toContain($sourceImage)
                ->and($item->getCustomProperty('seed_placeholder'))->toBeTrue()
                ->and($seedImagePath)->toBe('seed-images/properties/'.basename(dirname($sourceImage)).'/'.basename($sourceImage));
            Storage::disk('public')->assertExists($seedImagePath);
            Storage::disk('public')->assertMissing($item->getPathRelativeToRoot());
            expect(MediaResource::make($item)->resolve(request())['url'])
                ->toContain('/storage/'.$seedImagePath);
        });
    });

    $sourceImages->each(fn (string $image) => expect($image)->toBeFile());
    Queue::assertNotPushed(PerformConversionsJob::class);
});

test('it can copy seed images into media storage for legacy development seeds', function () {
    config(['crm.seeds.shared_property_images' => false]);
    $property = Property::factory()->create();

    $this->seed(PropertyMediaSeeder::class);

    $media = $property->fresh()->getMedia('gallery');

    expect($media)->not->toBeEmpty()
        ->and($media->every(fn ($item): bool => $item->getCustomProperty('seed_placeholder') !== true))->toBeTrue();
    Storage::disk('public')->assertExists($media->first()->getPathRelativeToRoot());
    Queue::assertPushed(PerformConversionsJob::class);
});

test('it clamps property image creation to the configured maximum total', function () {
    config([
        'crm.seeds.counts.property_media' => 2,
        'crm.seeds.max_counts.property_media' => 1,
    ]);

    Property::factory(2)->create();

    $this->seed(PropertyMediaSeeder::class);

    expect(Property::query()
        ->whereHas('media', fn ($query) => $query->where('collection_name', 'gallery'))
        ->count())->toBe(1);
});
