<?php

use App\Enums\LeadStatus;
use App\Models\Account;
use App\Models\Contact;
use App\Models\Lead;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\ContactSeeder;
use Database\Seeders\LeadSeeder;

beforeEach(function () {
    config([
        'crm.seeds.counts' => [Lead::class => 30],
        'crm.seeds.max_counts' => [Lead::class => 100000],
    ]);
});

test('lead seeder creates the approved status and assignment distribution', function () {
    $agentRole = Role::create(['name' => 'agent', 'guard_name' => 'web']);
    $agent = User::factory()->create();
    $agent->assignRole($agentRole);

    $this->seed(LeadSeeder::class);

    expect(Lead::query()->count())->toBe(30)
        ->and(Lead::query()->where('status', LeadStatus::QUALIFIED)->assigned()->count())->toBe(24)
        ->and(Lead::query()->where('status', LeadStatus::UNQUALIFIED)->assigned()->count())->toBe(2)
        ->and(Lead::query()->where('status', LeadStatus::CONTACTED)->count())->toBe(2)
        ->and(Lead::query()->where('status', LeadStatus::CONTACTED)->assigned()->count())->toBe(1)
        ->and(Lead::query()->where('status', LeadStatus::PENDING)->count())->toBe(2)
        ->and(Lead::query()->where('status', LeadStatus::PENDING)->assigned()->count())->toBe(1)
        ->and(Lead::query()->whereNull('assigned_agent_id')->count())->toBe(2);
});

test('lead seeder adds a batch per run and stops at the configured cap', function () {
    config(['crm.seeds.max_counts' => [Lead::class => 45]]);

    $agentRole = Role::create(['name' => 'agent', 'guard_name' => 'web']);
    $agent = User::factory()->create();
    $agent->assignRole($agentRole);

    $this->seed(LeadSeeder::class);
    expect(Lead::withTrashed()->count())->toBe(30);

    $this->seed(LeadSeeder::class);
    expect(Lead::withTrashed()->count())->toBe(45);

    $this->seed(LeadSeeder::class);
    expect(Lead::withTrashed()->count())->toBe(45);
});

test('lead seeder keeps email and phone unique across insertion batches', function () {
    config([
        'crm.seeds.counts' => [Lead::class => 401],
        'crm.seeds.max_counts' => [Lead::class => 401],
    ]);

    $agentRole = Role::create(['name' => 'agent', 'guard_name' => 'web']);
    $agent = User::factory()->create();
    $agent->assignRole($agentRole);

    $this->seed(LeadSeeder::class);

    expect(Lead::withTrashed()->pluck('email')->unique())->toHaveCount(401)
        ->and(Lead::withTrashed()->pluck('phone')->unique())->toHaveCount(401);
});

test('lead seeder counts soft deleted leads toward the cap', function () {
    config(['crm.seeds.max_counts' => [Lead::class => 30]]);

    $agentRole = Role::create(['name' => 'agent', 'guard_name' => 'web']);
    $agent = User::factory()->create();
    $agent->assignRole($agentRole);

    Lead::factory()->count(30)->create(['assigned_agent_id' => $agent->id]);
    Lead::query()->firstOrFail()->delete();

    $this->seed(LeadSeeder::class);

    expect(Lead::withTrashed()->count())->toBe(30)
        ->and(Lead::query()->count())->toBe(29);
});

test('lead seeder requires agents for assigned buckets', function () {
    expect(fn () => $this->seed(LeadSeeder::class))
        ->toThrow(RuntimeException::class, 'Cannot seed assigned leads because no agents exist.');
});

test('contact seeder bulk reconciles qualified assigned leads idempotently', function () {
    $agentRole = Role::create(['name' => 'agent', 'guard_name' => 'web']);
    $agent = User::factory()->create();
    $agent->assignRole($agentRole);
    $account = Account::factory()->create(['name' => 'Nike']);

    Lead::factory()->count(3)->qualified()->create([
        'assigned_agent_id' => $agent->id,
        'company_name' => $account->name,
    ]);

    $this->seed(ContactSeeder::class);

    expect(Contact::query()->count())->toBe(3)
        ->and(Contact::query()->pluck('lead_id')->unique())->toHaveCount(3);

    $this->seed(ContactSeeder::class);

    expect(Contact::query()->count())->toBe(3);
});
