<?php

use App\Enums\LeadStatus;
use App\Jobs\Lead\LeadConvertionJob;
use App\Models\Contact;
use App\Models\Lead;
use App\Models\User;
use App\Services\ContactService;
use Illuminate\Support\Facades\Queue;

test('a lead cannot be created as qualified', function () {
    $user = User::factory()->create(['is_super' => true]);

    $this->actingAs($user)
        ->postJson('/api/v1/leads', [
            'name' => 'Qualified at creation',
            'email' => 'qualified-at-creation@example.com',
            'phone' => '+201000000091',
            'status' => LeadStatus::QUALIFIED->value,
            'city' => 'Cairo',
            'company_name' => 'Northstar Developments',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');
});

test('qualifying a lead requires a company and assigned agent', function () {
    $user = User::factory()->create(['is_super' => true]);
    $lead = Lead::factory()->pending()->create([
        'company_name' => null,
        'assigned_agent_id' => null,
    ]);

    $this->actingAs($user)
        ->patchJson("/api/v1/leads/{$lead->id}", [
            'status' => LeadStatus::QUALIFIED->value,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['company_name', 'assigned_agent_id']);

    expect($lead->fresh()->status)->toBe(LeadStatus::PENDING);
});

test('qualifying a valid lead queues contact conversion', function () {
    Queue::fake();

    $user = User::factory()->create(['is_super' => true]);
    $agent = User::factory()->create();
    $lead = Lead::factory()->pending()->create([
        'company_name' => 'Northstar Developments',
        'assigned_agent_id' => $agent->id,
    ]);

    $this->actingAs($user)
        ->patchJson("/api/v1/leads/{$lead->id}", [
            'status' => LeadStatus::QUALIFIED->value,
        ])
        ->assertOk()
        ->assertJsonPath('lead.status', LeadStatus::QUALIFIED->value);

    Queue::assertPushed(LeadConvertionJob::class, fn (LeadConvertionJob $job) => $job->leadId === $lead->id);
});

test('lead conversion creates one contact and is idempotent', function () {
    $agent = User::factory()->create();
    $lead = Lead::factory()->qualified()->create([
        'company_name' => 'Northstar Developments',
        'assigned_agent_id' => $agent->id,
    ]);
    $service = app(ContactService::class);

    $first = $service->createFromQualifiedLead($lead->id);
    $second = $service->createFromQualifiedLead($lead->id);

    expect($first->id)->toBe($second->id)
        ->and(Contact::query()->where('lead_id', $lead->id)->count())->toBe(1)
        ->and($first->fresh()->name)->toBe($lead->name)
        ->and($first->fresh()->assigned_agent_id)->toBe($agent->id);
});
