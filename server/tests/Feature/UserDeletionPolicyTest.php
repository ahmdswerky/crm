<?php

use App\Models\Permission;
use App\Models\User;
use Spatie\Permission\PermissionRegistrar;

function grantUserDeletion(User $user): void
{
    $permission = Permission::findOrCreate('user.delete', config('auth.defaults.guard'));
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    $user->givePermissionTo($permission);
}

test('users cannot delete their own account', function () {
    $user = User::factory()->create();
    grantUserDeletion($user);

    $this->actingAs($user)
        ->deleteJson("/api/v1/users/{$user->id}")
        ->assertForbidden();

    $this->assertDatabaseHas('users', ['id' => $user->id]);
});

test('super admins cannot be deleted', function () {
    $actor = User::factory()->create();
    $superAdmin = User::factory()->create(['is_super' => true]);
    grantUserDeletion($actor);

    $this->actingAs($actor)
        ->deleteJson("/api/v1/users/{$superAdmin->id}")
        ->assertForbidden();

    $this->assertDatabaseHas('users', ['id' => $superAdmin->id]);
});

test('users with the delete permission can delete another non-super user', function () {
    $actor = User::factory()->create();
    $target = User::factory()->create(['is_super' => false]);
    grantUserDeletion($actor);

    $this->actingAs($actor)
        ->deleteJson("/api/v1/users/{$target->id}")
        ->assertNoContent();

    $this->assertSoftDeleted('users', ['id' => $target->id]);
});
