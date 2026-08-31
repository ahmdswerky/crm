<?php

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Spatie\Permission\PermissionRegistrar;

test('super admins manage roles through the documented method-spoofed API', function () {
    $superAdmin = User::factory()->create(['is_super' => true]);
    Permission::findOrCreate('lead.view', $guard = config('auth.defaults.guard'));
    Permission::findOrCreate('contact.view', $guard);
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    $this->actingAs($superAdmin)
        ->getJson('/api/v1/permissions')
        ->assertOk()
        ->assertJsonFragment(['name' => 'lead.view']);

    $this->actingAs($superAdmin)
        ->postJson('/api/v1/roles', [
            'name' => 'reviewer',
            'permissions' => ['lead.view'],
        ])
        ->assertCreated()
        ->assertJsonPath('role.name', 'reviewer')
        ->assertJsonPath('role.guard_name', $guard)
        ->assertJsonPath('role.permissions.0.name', 'lead.view');

    $role = Role::query()->where('name', 'reviewer')->firstOrFail();

    $this->actingAs($superAdmin)
        ->postJson("/api/v1/roles/{$role->id}", [
            '_method' => 'PUT',
            'name' => 'reviewer',
            'permissions' => ['contact.view'],
        ])
        ->assertOk()
        ->assertJsonPath('role.permissions.0.name', 'contact.view');

    expect($role->fresh()->permissions->pluck('name')->all())->toBe(['contact.view']);
});

test('role and permission endpoints reject non-super users', function () {
    $user = User::factory()->create(['is_super' => false]);

    $this->actingAs($user)->getJson('/api/v1/roles')->assertForbidden();
    $this->actingAs($user)->getJson('/api/v1/permissions')->assertForbidden();
});
