<?php

use App\Models\User;

test('users can authenticate through the API', function () {
    $user = User::factory()->create();

    $response = $this->postJson('/api/login', [
        'username' => $user->username,
        'password' => 'password',
    ]);

    $response
        ->assertOk()
        ->assertJsonPath('user.id', $user->id)
        ->assertJsonStructure(['user', 'token']);

    expect($response->json('token'))->toBeString();
});

test('users can not authenticate through the API with an invalid password', function () {
    $user = User::factory()->create();

    $this->postJson('/api/login', [
        'username' => $user->username,
        'password' => 'wrong-password',
    ])->assertUnauthorized();
});

test('users can revoke their current API token', function () {
    $user = User::factory()->create();
    $token = $user->createToken('login')->plainTextToken;

    $response = $this->withToken($token)->deleteJson('/api/logout');

    $response->assertNoContent();
    expect($user->tokens()->exists())->toBeFalse();
});
