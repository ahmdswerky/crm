<?php

use App\Enums\PropertyStatus;
use App\Models\Account;
use App\Models\Contact;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Permission;
use App\Models\Property;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
});

function createDealFor(User $agent): Deal
{
    $account = Account::factory()->create();
    $contact = createContactFor($agent, $account);
    $property = Property::factory()->create([
        'created_by' => $agent->id,
        'status' => PropertyStatus::PENDING,
    ]);

    return Deal::factory()->create([
        'contact_id' => $contact->id,
        'property_id' => $property->id,
        'agent_id' => $agent->id,
    ]);
}

function createContactFor(User $agent, Account $account): Contact
{
    $lead = Lead::factory()->pending()->create([
        'assigned_agent_id' => $agent->id,
    ]);

    return Contact::query()->create([
        'name' => fake()->name(),
        'title' => fake()->jobTitle(),
        'email' => fake()->unique()->safeEmail(),
        'phone' => fake()->unique()->e164PhoneNumber(),
        'account_id' => $account->id,
        'lead_id' => $lead->id,
        'assigned_agent_id' => $agent->id,
    ]);
}

test('a super user can consume the deal api', function () {
    if (! Route::has('deals.index')) {
        Route::middleware('api')
            ->prefix('api/v1')
            ->group(fn () => require base_path('routes/api/v1/deals.php'));
    }

    $user = User::factory()->create(['is_super' => true]);
    $agent = User::factory()->create();
    $replacementAgent = User::factory()->create();
    $agent
        ->addMedia(UploadedFile::fake()->image('agent-avatar.png'))
        ->toMediaCollection('main');
    $account = Account::factory()->create();
    $contact = createContactFor($agent, $account);
    $property = Property::factory()->create(['created_by' => $user->id]);
    $property
        ->addMedia(UploadedFile::fake()->image('deal-property-cover.png'))
        ->toMediaCollection('gallery');

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
        ->assertJsonPath('deal.contact.lead_id', $contact->lead_id)
        ->assertJsonPath('deal.property.id', $property->id)
        ->assertJsonPath('deal.agent.id', $agent->id)
        ->assertJsonPath('deal.agent.avatar.name', 'agent-avatar');

    $dealId = (int) $this->actingAs($user)
        ->getJson('/api/v1/deals')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.contact.lead_id', $contact->lead_id)
        ->assertJsonPath('data.0.property.images.0.name', 'deal-property-cover')
        ->assertJsonPath('data.0.agent.avatar.name', 'agent-avatar')
        ->json('data.0.id');

    $this->actingAs($user)
        ->getJson("/api/v1/deals/{$dealId}")
        ->assertOk()
        ->assertJsonPath('deal.contact.id', $contact->id)
        ->assertJsonPath('deal.property.id', $property->id)
        ->assertJsonPath('deal.agent.id', $agent->id)
        ->assertJsonPath('deal.agent.avatar.name', 'agent-avatar');

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

test('the deal index applies server-side value range filters', function () {
    if (! Route::has('deals.index')) {
        Route::middleware('api')
            ->prefix('api/v1')
            ->group(fn () => require base_path('routes/api/v1/deals.php'));
    }

    $user = User::factory()->create(['is_super' => true]);
    $first = createDealFor($user);
    $first->update(['value' => 100_000, 'deal_value' => 95_000]);
    $second = createDealFor($user);
    $second->update(['value' => 300_000, 'deal_value' => 280_000]);

    $this->actingAs($user)
        ->getJson('/api/v1/deals?min_value=250000&max_deal_value=290000')
        ->assertOk()
        ->assertJsonPath('data.0.id', $second->id)
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('filter.min_value', 100000)
        ->assertJsonPath('filter.max_deal_value', 280000);
});

test('the deal index filters by agent and supports a bounded page size', function () {
    $user = User::factory()->create(['is_super' => true]);
    $agent = User::factory()->create();
    $otherAgent = User::factory()->create();

    foreach (range(1, 4) as $_) {
        createDealFor($agent);
    }
    createDealFor($otherAgent);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/deals?agent={$agent->id}&per_page=3")
        ->assertOk()
        ->assertJsonCount(3, 'data')
        ->assertJsonPath('meta.total', 4)
        ->assertJsonPath('meta.per_page', 3);

    expect(collect($response->json('data'))->pluck('agent_id')->unique()->all())->toBe([(int) $agent->id]);
});

test('a deal owner can update their deal', function () {
    $owner = User::factory()->create();
    $deal = createDealFor($owner);

    $this->actingAs($owner)
        ->patchJson("/api/v1/deals/{$deal->id}", ['status' => 'won'])
        ->assertOk()
        ->assertJsonPath('deal.status', 'won');
});

test('a user with deal.edit can update another user\'s deal', function () {
    $user = User::factory()->create();
    $owner = User::factory()->create();
    $deal = createDealFor($owner);
    $permission = Permission::findOrCreate('deal.edit', config('auth.defaults.guard'));
    $user->givePermissionTo($permission);

    $this->actingAs($user)
        ->patchJson("/api/v1/deals/{$deal->id}", ['status' => 'won'])
        ->assertOk()
        ->assertJsonPath('deal.status', 'won');
});

test('a user without deal.edit cannot update another user\'s deal', function () {
    $user = User::factory()->create();
    $owner = User::factory()->create();
    $deal = createDealFor($owner);

    $this->actingAs($user)
        ->patchJson("/api/v1/deals/{$deal->id}", ['status' => 'won'])
        ->assertForbidden();
});

test('deal mutations derive the property status from all remaining deals', function () {
    $user = User::factory()->create(['is_super' => true]);
    $agent = User::factory()->create();
    $account = Account::factory()->create();
    $contacts = collect(range(1, 3))
        ->map(fn (): Contact => createContactFor($agent, $account));
    $property = Property::factory()->create([
        'created_by' => $user->id,
        'status' => PropertyStatus::PENDING,
    ]);
    $otherProperty = Property::factory()->create([
        'created_by' => $user->id,
        'status' => PropertyStatus::PENDING,
    ]);

    $createDeal = function (int $contactId, string $status) use ($user, $agent, $property): int {
        return (int) $this->actingAs($user)
            ->postJson('/api/v1/deals', [
                'deal_value' => $property->price,
                'contact_id' => $contactId,
                'property_id' => $property->id,
                'agent_id' => $agent->id,
                'status' => $status,
                'closed_at' => null,
            ])
            ->assertCreated()
            ->json('deal.id');
    };

    $viewingDealId = $createDeal($contacts[0]->id, 'viewing');
    expect($property->refresh()->status)->toBe(PropertyStatus::SHOWING);

    $inquiryDealId = $createDeal($contacts[1]->id, 'inquiry');
    expect($property->refresh()->status)->toBe(PropertyStatus::SHOWING);

    $this->actingAs($user)
        ->patchJson("/api/v1/deals/{$viewingDealId}", ['property_id' => $otherProperty->id])
        ->assertOk()
        ->assertJsonPath('deal.property.status', PropertyStatus::SHOWING->value);

    expect($property->refresh()->status)->toBe(PropertyStatus::PENDING)
        ->and($otherProperty->refresh()->status)->toBe(PropertyStatus::SHOWING);

    $this->actingAs($user)
        ->patchJson("/api/v1/deals/{$viewingDealId}", ['property_id' => $property->id])
        ->assertOk()
        ->assertJsonPath('deal.property.status', PropertyStatus::SHOWING->value);

    expect($property->refresh()->status)->toBe(PropertyStatus::SHOWING)
        ->and($otherProperty->refresh()->status)->toBe(PropertyStatus::PENDING);

    $this->actingAs($user)
        ->patchJson("/api/v1/deals/{$viewingDealId}", ['status' => 'lost'])
        ->assertOk()
        ->assertJsonPath('deal.property.status', PropertyStatus::PENDING->value);

    $this->actingAs($user)
        ->patchJson("/api/v1/deals/{$inquiryDealId}", ['status' => 'legal'])
        ->assertOk()
        ->assertJsonPath('deal.property.status', PropertyStatus::SHOWING->value);

    $wonDealId = $createDeal($contacts[2]->id, 'won');
    expect($property->refresh()->status)->toBe(PropertyStatus::SOLD);

    $this->actingAs($user)
        ->patchJson("/api/v1/deals/{$wonDealId}", ['status' => 'lost'])
        ->assertOk()
        ->assertJsonPath('deal.property.status', PropertyStatus::SHOWING->value);

    $this->actingAs($user)
        ->deleteJson("/api/v1/deals/{$inquiryDealId}")
        ->assertNoContent();

    expect($property->refresh()->status)->toBe(PropertyStatus::PENDING);
});
