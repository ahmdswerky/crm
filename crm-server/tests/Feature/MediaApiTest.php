<?php

use App\Models\Account;
use App\Models\Permission;
use App\Models\Property;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

beforeEach(function () {
    Storage::fake('public');
});

test('media routes require authentication', function () {
    $property = Property::factory()->create();

    $this->getJson("/api/v1/media?owner_type=property&owner_id={$property->id}&collection=gallery")
        ->assertUnauthorized();
});

test('an authenticated user can manage a gallery through the unified media api', function () {
    $editor = User::factory()->create();
    $property = Property::factory()->create([
        'created_by' => $editor->id,
        'title' => 'New York Villa',
    ]);

    $response = $this->actingAs($editor)
        ->post('/api/v1/media', [
            'owner_type' => 'property',
            'owner_id' => $property->id,
            'collection' => 'gallery',
            'files' => [
                UploadedFile::fake()->image('new-york-villa.png', 1600, 1200),
                UploadedFile::fake()->image('garden-view.jpg', 1600, 1200),
            ],
        ])
        ->assertCreated()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.order', 1)
        ->assertJsonPath('data.0.mime_type', 'image/webp');

    $firstMedia = Media::query()->findOrFail($response->json('data.0.id'));
    $media = Media::query()->where('model_id', $property->id)->orderBy('order_column')->get();

    expect($firstMedia->getPathRelativeToRoot())
        ->toContain("properties/{$property->id}/{$firstMedia->uuid}/")
        ->and($firstMedia->getPathRelativeToRoot())
        ->toEndWith('new-york-villa.webp');

    Storage::disk('public')->assertExists($firstMedia->getPathRelativeToRoot());

    $this->actingAs($editor)
        ->postJson('/api/v1/media/reorder', [
            'owner_type' => 'property',
            'owner_id' => $property->id,
            'collection' => 'gallery',
            'media_ids' => $media->pluck('id')->reverse()->values()->all(),
        ])
        ->assertOk()
        ->assertJsonPath('data.0.id', $media->last()->id)
        ->assertJsonPath('data.0.order', 1);

    $this->actingAs($editor)
        ->delete("/api/v1/media/{$firstMedia->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('media', ['id' => $firstMedia->id]);
    Storage::disk('public')->assertMissing($firstMedia->getPathRelativeToRoot());
});

test('an authenticated user can fetch a media collection without resource permissions', function () {
    $editor = User::factory()->create();
    $property = Property::factory()->create(['created_by' => $editor->id]);

    $this->actingAs($editor)
        ->getJson("/api/v1/media?owner_type=property&owner_id={$property->id}&collection=gallery")
        ->assertOk()
        ->assertJsonCount(0, 'data');
});

test('the first property gallery upload replaces shared seed-image placeholders', function () {
    $editor = User::factory()->create();
    $property = Property::factory()->create(['created_by' => $editor->id]);

    $placeholder = Media::query()->create([
        'model_type' => $property->getMorphClass(),
        'model_id' => $property->id,
        'uuid' => (string) Str::uuid(),
        'collection_name' => 'gallery',
        'name' => 'seed-image',
        'file_name' => 'seed-image.png',
        'mime_type' => 'image/png',
        'disk' => 'public',
        'size' => 1,
        'manipulations' => [],
        'custom_properties' => [
            'seed_placeholder' => true,
            'seed_image_path' => 'seed-images/test/seed-image.png',
        ],
        'generated_conversions' => [],
        'responsive_images' => [],
        'order_column' => 1,
    ]);

    $this->actingAs($editor)
        ->post('/api/v1/media', [
            'owner_type' => 'property',
            'owner_id' => $property->id,
            'collection' => 'gallery',
            'files' => [UploadedFile::fake()->image('uploaded.png')],
        ])
        ->assertCreated()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'uploaded');

    $this->assertDatabaseMissing('media', ['id' => $placeholder->id]);
    expect($property->fresh()->getMedia('gallery'))->toHaveCount(1)
        ->and($property->fresh()->getFirstMedia('gallery')->getCustomProperty('seed_placeholder'))->toBeNull();
});

test('unsupported collections are rejected and collection limits are configuration based', function () {
    $editor = User::factory()->create();
    $property = Property::factory()->create(['created_by' => $editor->id]);
    $this->actingAs($editor)
        ->getJson("/api/v1/media?owner_type=property&owner_id={$property->id}&collection=main")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('collection');

    collect(range(1, 20))->each(function (int $index) use ($property, $editor): void {
        $property
            ->addMedia(UploadedFile::fake()->image("existing-{$index}.png"))
            ->withCustomProperties(['uploaded_by' => $editor->id])
            ->toMediaCollection('gallery');
    });

    $this->actingAs($editor)
        ->post('/api/v1/media', [
            'owner_type' => 'property',
            'owner_id' => $property->id,
            'collection' => 'gallery',
            'files' => [UploadedFile::fake()->image('one-too-many.png')],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('files');
});

test('an authenticated user can replace and remove a main image through the unified media api', function () {
    $editor = User::factory()->create();
    $user = User::factory()->create(['name' => 'Jane Doe', 'username' => 'jane.doe']);

    $this->actingAs($editor)
        ->post('/api/v1/media', [
            'owner_type' => 'user',
            'owner_id' => $user->id,
            'collection' => 'main',
            'files' => [
                UploadedFile::fake()->image('jane-doe-one.png', 512, 512),
                UploadedFile::fake()->image('jane-doe-two.png', 512, 512),
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('files');

    $this->actingAs($editor)
        ->post('/api/v1/media', [
            'owner_type' => 'user',
            'owner_id' => $user->id,
            'collection' => 'main',
            'files' => [UploadedFile::fake()->image('jane-doe.png', 512, 512)],
        ])
        ->assertCreated()
        ->assertJsonPath('data.0.mime_type', 'image/webp');

    $firstAvatar = $user->fresh()->getFirstMedia('main');

    $this->actingAs($editor)
        ->post('/api/v1/media', [
            'owner_type' => 'user',
            'owner_id' => $user->id,
            'collection' => 'main',
            'files' => [UploadedFile::fake()->image('jane-doe-new.jpg', 512, 512)],
        ])
        ->assertCreated();

    $user->refresh();
    $avatar = $user->getFirstMedia('main');

    expect($user->getMedia('main'))->toHaveCount(1)
        ->and($avatar->id)->not->toBe($firstAvatar->id)
        ->and($avatar->getPathRelativeToRoot())->toContain("users/{$user->id}/{$avatar->uuid}/");

    $this->actingAs($editor)
        ->delete("/api/v1/media/{$avatar->id}")
        ->assertNoContent();

    expect($user->fresh()->getFirstMedia('main'))->toBeNull();
});

test('an account image is optional, replaceable, and returned by the account resource', function () {
    $editor = User::factory()->create();
    $editor->givePermissionTo(Permission::findOrCreate('account.view', config('auth.defaults.guard')));
    $account = Account::factory()->create();

    $this->actingAs($editor)
        ->getJson("/api/v1/accounts/{$account->id}")
        ->assertOk()
        ->assertJsonPath('account.image', null);

    $this->actingAs($editor)
        ->post('/api/v1/media', [
            'owner_type' => 'account',
            'owner_id' => $account->id,
            'collection' => 'main',
            'files' => [
                UploadedFile::fake()->image('northstar-one.png', 512, 512),
                UploadedFile::fake()->image('northstar-two.png', 512, 512),
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('files');

    $response = $this->actingAs($editor)
        ->post('/api/v1/media', [
            'owner_type' => 'account',
            'owner_id' => $account->id,
            'collection' => 'main',
            'files' => [UploadedFile::fake()->image('northstar.png', 512, 512)],
        ])
        ->assertCreated();

    $firstImage = $account->fresh()->getFirstMedia('main');

    $this->actingAs($editor)
        ->getJson("/api/v1/accounts/{$account->id}")
        ->assertOk()
        ->assertJsonPath('account.image.id', $response->json('data.0.id'));

    $this->actingAs($editor)
        ->post('/api/v1/media', [
            'owner_type' => 'account',
            'owner_id' => $account->id,
            'collection' => 'main',
            'files' => [UploadedFile::fake()->image('northstar-new.jpg', 512, 512)],
        ])
        ->assertCreated();

    $image = $account->fresh()->getFirstMedia('main');

    expect($account->getMedia('main'))->toHaveCount(1)
        ->and($image->id)->not->toBe($firstImage->id)
        ->and($image->getPathRelativeToRoot())->toContain("accounts/{$account->id}/{$image->uuid}/");
});

function uploadToGallery(User $editor, Property $property, array $files)
{
    return test()->actingAs($editor)->post('/api/v1/media', [
        'owner_type' => 'property',
        'owner_id' => $property->id,
        'collection' => 'gallery',
        'files' => $files,
    ], ['Accept' => 'application/json']);
}

function fakeImageWithContents(string $name, string $contents): UploadedFile
{
    $path = tempnam(sys_get_temp_dir(), 'upload');
    file_put_contents($path, $contents);

    return new UploadedFile($path, $name, null, null, true);
}

test('corrupt or disguised files are rejected without storing anything', function (UploadedFile $file) {
    $editor = User::factory()->create();
    $property = Property::factory()->create(['created_by' => $editor->id]);

    uploadToGallery($editor, $property, [UploadedFile::fake()->image('ok.jpg', 64, 64), $file])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('files.1');

    expect(Media::query()->count())->toBe(0)
        ->and(Storage::disk('public')->allFiles())->toBe([]);
})->with([
    'truncated jpeg' => fn () => fakeImageWithContents('cut.jpg', substr(UploadedFile::fake()->image('a.jpg', 400, 400)->getContent(), 0, 600)),
    'text renamed to jpg' => fn () => fakeImageWithContents('evil.jpg', 'not an image at all'),
    'svg' => fn () => fakeImageWithContents('evil.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
]);

test('uploads are re-encoded to webp, dropping appended payloads', function () {
    $editor = User::factory()->create();
    $property = Property::factory()->create(['created_by' => $editor->id]);
    $payload = '<?php system($_GET["c"]); ?>';
    $file = fakeImageWithContents('poly.png', UploadedFile::fake()->image('a.png', 64, 64)->getContent().$payload);

    uploadToGallery($editor, $property, [$file])
        ->assertCreated()
        ->assertJsonPath('data.0.mime_type', 'image/webp');

    $stored = Storage::disk('public')->get(Media::query()->sole()->getPathRelativeToRoot());

    expect(substr($stored, 8, 4))->toBe('WEBP')
        ->and($stored)->not->toContain($payload);
});

test('images larger than 8000 pixels are rejected', function () {
    $editor = User::factory()->create();
    $property = Property::factory()->create(['created_by' => $editor->id]);

    uploadToGallery($editor, $property, [UploadedFile::fake()->image('huge.png', 8001, 10)])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('files.0');
});

test('media uploads are throttled per user', function () {
    $editor = User::factory()->create();
    $property = Property::factory()->create(['created_by' => $editor->id]);

    foreach (range(1, 20) as $attempt) {
        uploadToGallery($editor, $property, [])->assertUnprocessable();
    }

    uploadToGallery($editor, $property, [])->assertTooManyRequests();
});

test('demo reset refuses to run outside demo mode', function () {
    config(['crm.demo' => false]);

    expect(Artisan::call('demo:reset'))->toBe(1);
});
