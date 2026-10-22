<?php

use App\Models\Account;
use Database\Seeders\AccountSeeder;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    config(['media-library.queue_conversions_after_database_commit' => false]);
    Queue::fake();
    Storage::fake('public');
});

test('company accounts are seeded with their matching SVG image', function () {
    $companies = [
        'Nike' => 'nike.svg',
        'IKEA' => 'ikea.svg',
        'Apple' => 'apple.svg',
        'Google' => 'google.svg',
        'Uber' => 'uber.svg',
    ];

    $this->seed(AccountSeeder::class);

    foreach ($companies as $company => $fileName) {
        $account = Account::query()->where('name', $company)->firstOrFail();
        $image = $account->getFirstMedia('main');

        expect($account->getMedia('main'))->toHaveCount(1)
            ->and($image->file_name)->toBe($fileName)
            ->and($image->mime_type)->toBe('image/svg+xml')
            ->and($image->getPathRelativeToRoot())->toContain("accounts/{$account->id}/{$image->uuid}/");
    }
});
