<?php

use App\Models\Permission;
use App\Models\Property;
use App\Models\User;

test('the properties index returns twelve listings per page', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(Permission::findOrCreate('property.view', config('auth.defaults.guard')));

    Property::factory(13)->create(['created_by' => $user->id]);

    $this->actingAs($user)
        ->getJson('/api/v1/properties')
        ->assertOk()
        ->assertJsonCount(12, 'data')
        ->assertJsonPath('meta.per_page', 12)
        ->assertJsonPath('meta.last_page', 2);
});
