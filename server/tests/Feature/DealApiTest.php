<?php

use App\Models\Account;
use App\Models\Contact;
use App\Models\Property;
use App\Models\User;
use Illuminate\Support\Facades\Route;

test('a super user can consume the deal api', function () {
    if (! Route::has('deals.index')) {
        Route::middleware('api')
            ->prefix('api/v1')
            ->group(fn () => require base_path('routes/api/v1/deals.php'));
    }

    $user = User::factory()->create(['is_super' => true]);
    $agent = User::factory()->create();
    $replacementAgent = User::factory()->create();
    Account::factory()->create();
    $contact = Contact::factory()->create();
    $property = Property::factory()->create(['created_by' => $user->id]);

    $this->actingAs($user)
        ->postJson('/api/v1/deals', [
            'value' => 250000,
            'deal_value' => 240000,
            'contact_id' => $contact->id,
            'property_id' => $property->id,
            'status' => 'invalid',
            'commission_rate' => 2.5,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status', 'agent_id']);

    $payload = [
        'value' => 250000,
        'deal_value' => 240000,
        'contact_id' => $contact->id,
        'property_id' => $property->id,
        'agent_id' => $agent->id,
        'status' => 'inquiry',
        'commission_rate' => 2.5,
        'closed_at' => null,
    ];

    $this->actingAs($user)
        ->postJson('/api/v1/deals', $payload)
        ->assertCreated()
        ->assertJsonPath('deal.status', 'inquiry')
        ->assertJsonPath('deal.contact.id', $contact->id)
        ->assertJsonPath('deal.property.id', $property->id)
        ->assertJsonPath('deal.agent.id', $agent->id);

    $dealId = (int) $this->actingAs($user)
        ->getJson('/api/v1/deals')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->json('data.0.id');

    $this->actingAs($user)
        ->getJson("/api/v1/deals/{$dealId}")
        ->assertOk()
        ->assertJsonPath('deal.contact.id', $contact->id)
        ->assertJsonPath('deal.property.id', $property->id)
        ->assertJsonPath('deal.agent.id', $agent->id);

    $this->actingAs($user)
        ->patchJson("/api/v1/deals/{$dealId}", [
            'status' => 'won',
            'closed_at' => '2026-07-17',
            'agent_id' => $replacementAgent->id,
        ])
        ->assertOk()
        ->assertJsonPath('deal.status', 'won')
        ->assertJsonPath('deal.closed_at', '2026-07-17T00:00:00.000000Z')
        ->assertJsonPath('deal.agent.id', $replacementAgent->id);

    $this->actingAs($user)
        ->deleteJson("/api/v1/deals/{$dealId}")
        ->assertNoContent();

    $this->assertSoftDeleted('deals', ['id' => $dealId]);
});
