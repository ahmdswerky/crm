<?php

use App\Enums\DealStatus;
use App\Enums\LeadStatus;
use App\Enums\PropertyPurpose;
use App\Enums\PropertyStatus;
use App\Enums\PropertyType;
use App\Models\Account;
use App\Models\Contact;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Property;
use App\Models\ReportRun;
use App\Models\Role;
use App\Models\User;
use App\Services\OverviewAnalyticsService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

test('a super user can read the live analytics overview', function () {
    $viewer = User::factory()->create(['is_super' => true]);

    $this->actingAs($viewer)
        ->getJson('/api/v1/analytics/overview')
        ->assertOk()
        ->assertJsonStructure(['overview' => ['as_of', 'today', 'month_to_date', 'pipeline', 'inventory']]);
});

test('overview endpoints return small independently cacheable sections', function () {
    Carbon::setTestNow('2026-08-13 12:00:00');

    try {
        $viewer = User::factory()->create(['is_super' => true]);
        $agentRole = Role::findOrCreate('agent', 'web');
        $viewer->assignRole($agentRole);
        $agentWithoutSales = User::factory()->create(['name' => 'Agent Without Sales']);
        $agentWithoutSales->assignRole($agentRole);
        $account = Account::factory()->create();
        $lead = Lead::factory()->create([
            'name' => 'Qualified Customer',
            'status' => LeadStatus::QUALIFIED,
            'assigned_agent_id' => $viewer->id,
            'company_name' => $account->name,
            'created_at' => now()->subDays(2),
        ]);
        $contact = Contact::query()->create([
            'account_id' => $account->id,
            'lead_id' => $lead->id,
            'name' => $lead->name,
            'title' => 'Director',
            'email' => $lead->email,
            'phone' => $lead->phone,
            'assigned_agent_id' => $viewer->id,
        ]);
        $property = Property::query()->create([
            'created_by' => $viewer->id,
            'title' => 'Overview Villa',
            'description' => 'A dashboard test property.',
            'city' => 'Cairo',
            'price' => 100000,
            'purpose' => PropertyPurpose::SALE,
            'type' => PropertyType::VILLA,
            'status' => PropertyStatus::SOLD,
            'created_at' => now()->subDay(),
        ]);
        Deal::query()->create([
            'value' => 100000,
            'deal_value' => 125000,
            'contact_id' => $contact->id,
            'property_id' => $property->id,
            'agent_id' => $viewer->id,
            'status' => DealStatus::WON,
            'commission_rate' => 2.5,
            'closed_at' => now()->subDay(),
        ]);

        $overview = app(OverviewAnalyticsService::class);
        $overview->forgetAll();
        DB::flushQueryLog();
        DB::enableQueryLog();
        $overview->metrics();
        $coldMetricsQueries = count(DB::getQueryLog());
        DB::flushQueryLog();
        $overview->metrics();
        $warmMetricsQueries = count(DB::getQueryLog());
        DB::disableQueryLog();
        expect($coldMetricsQueries)->toBeLessThanOrEqual(5);
        expect($warmMetricsQueries)->toBe(0);

        $this->actingAs($viewer)
            ->getJson('/api/v1/analytics/metrics')
            ->assertOk()
            ->assertHeader('cache-control', 'max-age=15, private, stale-while-revalidate=30')
            ->assertJsonPath('metrics.new_leads.value', 1)
            ->assertJsonPath('metrics.revenue.value', 125000);

        $this->actingAs($viewer)
            ->getJson('/api/v1/analytics/leaderboard?range=week')
            ->assertOk()
            ->assertJsonPath('leaderboard.range', 'week')
            ->assertJsonPath('leaderboard.data.0.name', $viewer->name)
            ->assertJsonPath('leaderboard.data.0.value', 125000)
            ->assertJsonFragment(['name' => 'Agent Without Sales', 'value' => 0]);

        $this->actingAs($viewer)
            ->getJson('/api/v1/analytics/revenue?range=week')
            ->assertOk()
            ->assertJsonPath('revenue.range', 'week');

        $this->actingAs($viewer)
            ->getJson('/api/v1/analytics/revenue?range=all-time')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('range');

        $this->actingAs($viewer)
            ->getJson('/api/v1/analytics/customers')
            ->assertOk()
            ->assertJsonPath('customers.0.name', 'Qualified Customer');

        $this->actingAs($viewer)
            ->getJson('/api/v1/analytics/deals')
            ->assertOk()
            ->assertJsonPath('deals.0.status', DealStatus::WON->value);

        $this->actingAs($viewer)
            ->getJson('/api/v1/analytics/accounts')
            ->assertOk()
            ->assertJsonPath('accounts.0.id', $account->id);

        $this->actingAs($viewer)
            ->getJson('/api/v1/analytics/properties')
            ->assertOk()
            ->assertJsonPath('properties.0.id', $property->id);

        foreach ([
            'leaderboard' => fn () => $overview->leaderboard('week'),
            'revenue' => fn () => $overview->revenue('week'),
            'customers' => fn () => $overview->customers(),
            'deals' => fn () => $overview->deals(),
            'accounts' => fn () => $overview->accounts(),
            'properties' => fn () => $overview->properties(),
        ] as $section => $load) {
            $overview->forgetAll();
            DB::flushQueryLog();
            DB::enableQueryLog();
            $load();
            $coldQueries = count(DB::getQueryLog());
            DB::flushQueryLog();
            $load();
            $warmQueries = count(DB::getQueryLog());
            DB::disableQueryLog();

            expect($coldQueries, "{$section} cold query count")->toBeLessThanOrEqual(4);
            expect($warmQueries, "{$section} warm query count")->toBe(0);
        }
    } finally {
        Carbon::setTestNow();
    }
});

test('overview cache is invalidated when overview source data changes', function () {
    Carbon::setTestNow('2026-08-13 12:00:00');

    try {
        $overview = app(OverviewAnalyticsService::class);
        $overview->forgetAll();
        $overview->metrics();

        DB::flushQueryLog();
        DB::enableQueryLog();
        $overview->metrics();
        expect(count(DB::getQueryLog()))->toBe(0);

        Lead::factory()->create(['created_at' => now()->subDay()]);

        DB::flushQueryLog();
        $overview->metrics();
        expect(count(DB::getQueryLog()))->toBeGreaterThan(0);
        DB::disableQueryLog();
    } finally {
        Carbon::setTestNow();
    }
});

test('a completed report can be listed, viewed, and downloaded', function () {
    Storage::fake('local');
    $viewer = User::factory()->create(['is_super' => true]);
    $path = 'reports/daily/2026-08-10/example.csv';
    Storage::disk('local')->put($path, "metric,value\nnew_leads,2\n");
    $report = ReportRun::query()->create([
        'uuid' => (string) Str::uuid(),
        'definition' => 'sales_pipeline',
        'cadence' => 'daily',
        'status' => 'completed',
        'period_start' => '2026-08-10 00:00:00',
        'period_end' => '2026-08-11 00:00:00',
        'completed_at' => '2026-08-11 00:01:00',
        'duration_ms' => 120,
        'snapshot' => ['summary' => ['new_leads' => 2]],
        'csv_path' => $path,
        'csv_checksum' => hash('sha256', "metric,value\nnew_leads,2\n"),
        'csv_size' => 26,
    ]);

    $this->actingAs($viewer)
        ->getJson('/api/v1/analytics/reports')
        ->assertOk()
        ->assertJsonPath('data.0.id', $report->uuid);

    $this->actingAs($viewer)
        ->getJson("/api/v1/analytics/reports/{$report->uuid}")
        ->assertOk()
        ->assertJsonPath('report.snapshot.summary.new_leads', 2);

    $this->actingAs($viewer)
        ->get("/api/v1/analytics/reports/{$report->uuid}/download")
        ->assertOk();
});
