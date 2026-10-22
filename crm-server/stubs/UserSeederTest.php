<?php

use App\Models\User;
use Database\Seeders\UserSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    config(['media-library.queue_conversions_after_database_commit' => false]);
    Queue::fake();
    Storage::fake('public');
});

test('seeded users receive their deterministic avatar images', function () {
    $avatars = [
        'owner@crm.io' => '1-male.jpg',
        'dev@crm.io' => '2-male.jpg',
        'michael@crm.io' => '3-male.jpg',
        'chris@crm.io' => '1-male.jpg',
        'j.ryan.agent@crm.io' => '2-male.jpg',
        'm.hassan.agent@crm.io' => '1-female.jpg',
        'o.khalil.agent@crm.io' => '3-male.jpg',
        'l.adel.agent@crm.io' => '2-female.jpg',
        'k.nassar.agent@crm.io' => '1-male.jpg',
        'n.samir.agent@crm.io' => '3-female.jpg',
    ];

    $this->seed(UserSeeder::class);

    foreach ($avatars as $email => $filename) {
        $user = User::query()->where('email', $email)->firstOrFail();
        $avatar = $user->getFirstMedia('main');

        expect($user->getMedia('main'))->toHaveCount(1)
            ->and($avatar)->not->toBeNull()
            ->and($avatar->file_name)->toBe($filename)
            ->and($avatar->getCustomProperty('seed_placeholder'))->toBeNull()
            ->and($avatar->getPathRelativeToRoot())->toContain("users/{$user->id}/{$avatar->uuid}/");

        Storage::disk('public')->assertExists($avatar->getPathRelativeToRoot());
    }
});

test('seeding does not replace an existing user avatar', function () {
    $user = User::factory()->create([
        'email' => 'owner@crm.io',
    ]);

    $existingAvatar = $user
        ->addMedia(UploadedFile::fake()->image('custom-avatar.jpg'))
        ->toMediaCollection('main');

    $this->seed(UserSeeder::class);

    $user->refresh();
    $avatar = $user->getFirstMedia('main');

    expect($user->getMedia('main'))->toHaveCount(1)
        ->and($avatar->id)->toBe($existingAvatar->id)
        ->and($avatar->file_name)->toBe('custom-avatar.jpg');
});
