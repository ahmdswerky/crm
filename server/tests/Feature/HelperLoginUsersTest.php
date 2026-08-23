<?php

use App\Models\Role;
use App\Models\User;

test('login users exposes only the fields needed by the login picker', function () {
    $agentRole = Role::create(['name' => 'agent', 'guard_name' => 'web']);
    $managerRole = Role::create(['name' => 'manager', 'guard_name' => 'web']);

    $agent = User::factory()->create(['username' => 'agent']);
    $agent->assignRole($agentRole);

    $manager = User::factory()->create(['username' => 'manager']);
    $manager->assignRole($managerRole);

    User::factory()->create(['username' => 'owner', 'is_super' => true]);

    $response = $this->getJson('/api/v1/login-users');

    $response->assertOk()
        ->assertExactJson([
            ['username' => 'owner', 'role' => null, 'is_super' => true],
            ['username' => 'manager', 'role' => 'manager', 'is_super' => false],
            ['username' => 'agent', 'role' => 'agent', 'is_super' => false],
        ]);

    expect($response->headers->get('Cache-Control'))->toContain('no-store');
});
