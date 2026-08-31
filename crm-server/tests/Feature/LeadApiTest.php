<?php

use App\Enums\LeadStatus;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Support\Facades\Route;

test('a lead can be assigned, reassigned, and unassigned', function () {
    if (! Route::has('leads.index')) {
        Route::middleware('api')
            ->prefix('api/v1')
            ->group(fn () => require base_path('routes/api/v1/leads.php'));
    }

    $user = User::factory()->create(['is_super' => true]);
    $agent = User::factory()->create();
    $replacementAgent = User::factory()->create();

    $payload = [
        'name' => 'Assigned Lead',
        'email' => 'assigned-lead@example.com',
        'phone' => '+201000000001',
        'city' => 'Cairo',
    ];

    $this->actingAs($user)
        ->postJson('/api/v1/leads', $payload)
        ->assertCreated()
        ->assertJsonPath('lead.assigned_agent_id', null);

    $lead = Lead::query()->where('email', $payload['email'])->firstOrFail();

    $this->actingAs($user)
        ->patchJson("/api/v1/leads/{$lead->id}", [
            'assigned_agent_id' => $replacementAgent->id,
        ])
        ->assertOk()
        ->assertJsonPath('lead.assigned_agent_id', $replacementAgent->id)
        ->assertJsonPath('lead.assigned_agent.id', $replacementAgent->id)
        ->assertJsonMissingPath('lead.assigned_agent.roles')
        ->assertJsonMissingPath('lead.assigned_agent.permissions');

    $this->actingAs($user)
        ->patchJson("/api/v1/leads/{$lead->id}", [
            'assigned_agent_id' => null,
        ])
        ->assertOk()
        ->assertJsonPath('lead.assigned_agent_id', null);

    $this->actingAs($user)
        ->postJson('/api/v1/leads', [
            ...$payload,
            'email' => 'invalid-agent@example.com',
            'phone' => '+201000000002',
            'assigned_agent_id' => 999999,
        ])
        ->assertCreated()
        ->assertJsonPath('lead.assigned_agent_id', null);
});

test('leads index honors the assigned agent and per-page limit', function () {
    if (! Route::has('leads.index')) {
        Route::middleware('api')
            ->prefix('api/v1')
            ->group(fn () => require base_path('routes/api/v1/leads.php'));
    }

    $user = User::factory()->create(['is_super' => true]);
    $agent = User::factory()->create();
    Lead::factory()->count(4)->create(['assigned_agent_id' => $agent->id]);
    Lead::factory()->create();

    $this->actingAs($user)
        ->getJson("/api/v1/leads?assigned_agent={$agent->id}&per_page=3")
        ->assertOk()
        ->assertJsonCount(3, 'data')
        ->assertJsonPath('meta.per_page', 3)
        ->assertJsonPath('meta.total', 4);

    $this->actingAs($user)
        ->getJson('/api/v1/leads?per_page=101')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('per_page');
});

test('pipeline board bootstraps every status in one cursor-ready response', function () {
    $user = User::factory()->create(['is_super' => true]);
    $createdAt = now()->subHour();

    Lead::factory()->count(3)->create(['status' => LeadStatus::PENDING, 'created_at' => $createdAt]);
    Lead::factory()->count(2)->create(['status' => LeadStatus::CONTACTED, 'created_at' => $createdAt]);
    Lead::factory()->create(['status' => LeadStatus::QUALIFIED, 'created_at' => $createdAt]);

    $response = $this->actingAs($user)
        ->getJson('/api/v1/leads/board?per_page=2')
        ->assertOk()
        ->assertJsonPath('columns.pending.total', 3)
        ->assertJsonCount(2, 'columns.pending.data')
        ->assertJsonPath('columns.pending.has_more', true)
        ->assertJsonPath('columns.contacted.total', 2)
        ->assertJsonCount(2, 'columns.contacted.data')
        ->assertJsonPath('columns.contacted.has_more', false)
        ->assertJsonPath('columns.qualified.total', 1)
        ->assertJsonPath('columns.unqualified.total', 0)
        ->assertJsonPath('stats.pending_count', 3);

    $firstPageIds = collect($response->json('columns.pending.data'))->pluck('id');
    $cursor = $response->json('columns.pending.next_cursor');
    $nextPage = $this->actingAs($user)
        ->getJson('/api/v1/leads/board/pending?per_page=2&cursor='.urlencode($cursor));

    $nextPage
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('has_more', false)
        ->assertJsonMissingPath('stats')
        ->assertJsonMissingPath('total');

    expect($firstPageIds)->not->toContain($nextPage->json('data.0.id'));
});
