<?php

use App\Enums\LeadStatus;
use App\Enums\PropertyPurpose;
use App\Enums\PropertyStatus;
use App\Enums\PropertyType;
use App\Models\Account;
use App\Models\Contact;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Property;
use App\Models\User;
use Database\Seeders\DealSeeder;

test('deal seeder inserts the configured count across bulk batches', function () {
    config(['crm.seeds.counts' => [Deal::class => 201]]);

    $agent = User::factory()->create();
    $account = Account::factory()->create();
    $lead = Lead::factory()->create([
        'status' => LeadStatus::PENDING,
        'assigned_agent_id' => $agent->id,
        'company_name' => $account->name,
    ]);
    $contact = Contact::query()->create([
        'account_id' => $account->id,
        'lead_id' => $lead->id,
        'name' => $lead->name,
        'email' => $lead->email,
        'phone' => $lead->phone,
        'assigned_agent_id' => $agent->id,
    ]);
    Property::query()->create([
        'created_by' => $agent->id,
        'title' => 'Seed property',
        'description' => 'Seed property description',
        'city' => 'Cairo',
        'address' => 'Seed address',
        'price' => 100000,
        'purpose' => PropertyPurpose::SALE,
        'type' => PropertyType::VILLA,
        'status' => PropertyStatus::PENDING,
    ]);

    $this->seed(DealSeeder::class);

    expect(Deal::query()->count())->toBe(201)
        ->and(Deal::query()->where('contact_id', $contact->id)->count())->toBe(201);
});

test('deal seeder clamps a batch to the configured maximum total', function () {
    config([
        'crm.seeds.counts' => [Deal::class => 201],
        'crm.seeds.max_counts' => [Deal::class => 100],
    ]);

    $agent = User::factory()->create();
    $account = Account::factory()->create();
    $lead = Lead::factory()->create([
        'status' => LeadStatus::PENDING,
        'assigned_agent_id' => $agent->id,
        'company_name' => $account->name,
    ]);
    Contact::query()->create([
        'account_id' => $account->id,
        'lead_id' => $lead->id,
        'name' => $lead->name,
        'email' => $lead->email,
        'phone' => $lead->phone,
        'assigned_agent_id' => $agent->id,
    ]);
    Property::query()->create([
        'created_by' => $agent->id,
        'title' => 'Capped seed property',
        'description' => 'Capped seed property description',
        'city' => 'Cairo',
        'address' => 'Capped seed address',
        'price' => 100000,
        'purpose' => PropertyPurpose::SALE,
        'type' => PropertyType::VILLA,
        'status' => PropertyStatus::PENDING,
    ]);

    $this->seed(DealSeeder::class);

    expect(Deal::withTrashed()->count())->toBe(100);
});
