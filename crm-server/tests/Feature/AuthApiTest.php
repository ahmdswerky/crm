<?php

use App\Models\User;
use App\Services\SecureHashGeneratorService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

test('an authenticated user can update their own profile', function () {
    $user = User::factory()->create([
        'name' => 'Current User',
        'username' => 'current.user',
        'email' => 'current@example.test',
        'phone' => '+201000000001',
    ]);

    $token = $user->createToken('profile-update')->plainTextToken;

    $this->withToken($token)
        ->putJson('/api/user', [
            'name' => 'Updated User',
            'username' => 'updated.user',
            'email' => 'updated@example.test',
            'phone' => '+201000000002',
        ])
        ->assertOk()
        ->assertJsonPath('user.id', $user->id)
        ->assertJsonPath('user.name', 'Updated User')
        ->assertJsonPath('user.username', 'updated.user')
        ->assertJsonPath('user.email', 'updated@example.test')
        ->assertJsonPath('user.phone', '+201000000002');

    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'name' => 'Updated User',
        'username' => 'updated.user',
        'email' => 'updated@example.test',
        'phone' => '+201000000002',
    ]);
});

test('profile updates reject values already used by another user', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    $token = $user->createToken('profile-validation')->plainTextToken;

    $this->withToken($token)
        ->putJson('/api/user', [
            'name' => 'Updated User',
            'username' => $otherUser->username,
            'email' => 'updated@example.test',
            'phone' => '+201000000002',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('username');
});

test('profile updates preserve fields omitted from a partial request', function () {
    $user = User::factory()->create([
        'name' => 'Current User',
        'username' => 'current.user',
        'email' => 'current@example.test',
        'phone' => '+201000000001',
    ]);

    $token = $user->createToken('profile-partial-update')->plainTextToken;

    $this->withToken($token)
        ->putJson('/api/user', ['phone' => '+201000000002'])
        ->assertOk()
        ->assertJsonPath('user.name', 'Current User')
        ->assertJsonPath('user.phone', '+201000000002');

    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'name' => 'Current User',
        'phone' => '+201000000002',
    ]);
});

test('logout revokes only the current access token', function () {
    $user = User::factory()->create();
    $currentToken = $user->createToken('current');
    $otherToken = $user->createToken('other');

    $this->withToken($currentToken->plainTextToken)
        ->deleteJson('/api/logout')
        ->assertNoContent();

    expect($user->tokens()->whereKey($currentToken->accessToken->id)->exists())->toBeFalse()
        ->and($user->tokens()->whereKey($otherToken->accessToken->id)->exists())->toBeTrue();
});

test('the configured developer can generate secure tool links', function () {
    $user = User::factory()->create([
        'email' => config('app.dev_email'),
        'is_super' => true,
    ]);

    $token = $user->createToken('secure-token')->plainTextToken;

    $response = $this->withToken($token)
        ->getJson('/api/secure-token')
        ->assertOk();

    $token = $response->json('token');

    expect($token)->toBeString()
        ->and($response->headers->get('Cache-Control'))->toContain('no-store')
        ->and(Hash::check($user->getRememberToken(), $token))->toBeTrue()
        ->and($response->json('horizon'))->toContain('/api/secure-login')
        ->and($response->json('horizon'))->toContain('destination=horizon')
        ->and($response->json('telescope'))->toContain('/api/secure-login')
        ->and($response->json('telescope'))->toContain('destination=telescope');
});

test('the owner cannot generate secure tool links', function () {
    $owner = User::factory()->create([
        'email' => 'owner@crm.io',
        'is_super' => true,
    ]);

    $token = $owner->createToken('secure-token')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/secure-token')
        ->assertForbidden();
});

test('only the configured developer receives secure token capability', function () {
    $owner = User::factory()->create([
        'email' => 'owner@crm.io',
        'is_super' => true,
    ]);

    $ownerToken = $owner->createToken('user')->plainTextToken;

    $this->withToken($ownerToken)
        ->getJson('/api/user')
        ->assertJsonPath('user.can_generate_secure_token', false);

    $developer = User::factory()->create([
        'email' => config('app.dev_email'),
        'is_super' => true,
    ]);

    $developerToken = $developer->createToken('user')->plainTextToken;

    Auth::forgetGuards();

    $this->withToken($developerToken)
        ->getJson('/api/user')
        ->assertJsonPath('user.can_generate_secure_token', true);
});

test('a secure tool link logs in the developer and redirects to its configured path', function () {
    $user = User::factory()->create([
        'email' => config('app.dev_email'),
        'is_super' => true,
    ]);
    $token = SecureHashGeneratorService::generateSecureToken($user);

    $this->get(route('login.secure', [
        'secure_token' => $token,
        'user' => $user->id,
        'destination' => 'telescope',
    ]))
        ->assertRedirect('/'.ltrim((string) config('telescope.path'), '/'));

    expect(Auth::guard('web')->id())->toBe($user->id);
});

test('a regular user cannot generate a secure token', function () {
    $user = User::factory()->create(['is_super' => false]);

    $token = $user->createToken('secure-token')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/secure-token')
        ->assertForbidden();
});
