<?php

use App\Enums\CommissionAllocationState;
use App\Enums\DealStatus;
use App\Models\Account;
use App\Models\CommissionAllocation;
use App\Models\CommissionPolicy;
use App\Models\Contact;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Property;
use App\Models\User;
use App\Services\CommissionService;

function commissionDealFor(User $agent, array $attributes = []): Deal
{
    $account = Account::factory()->create();
    $lead = Lead::factory()->pending()->create(['assigned_agent_id' => $agent->id]);
    $contact = Contact::factory()->create([
        'account_id' => $account->id,
        'lead_id' => $lead->id,
        'assigned_agent_id' => $agent->id,
    ]);
    $property = Property::factory()->create([
        'created_by' => $agent->id,
        'status' => 'pending',
    ]);

    return Deal::factory()->create([
        'value' => 100_000,
        'deal_value' => 100_000,
        'contact_id' => $contact->id,
        'property_id' => $property->id,
        'agent_id' => $agent->id,
        'status' => DealStatus::INQUIRY,
        'commission_rate' => 0,
        ...$attributes,
    ]);
}

test('a deal stores agent manager and company commission allocations', function () {
    $manager = User::factory()->create();
    $agent = User::factory()->create(['direct_manager_id' => $manager->id]);
    $deal = commissionDealFor($agent);
    $companyAmount = round(100_000 * (float) config('crm.commission_rates.company', 0) / 100, 2);

    app(CommissionService::class)->recalculate($deal);

    $deal->refresh();

    expect($deal->commission_status)->toBe(CommissionAllocationState::ESTIMATE)
        ->and($deal->commission_version)->toBe(1)
        ->and($deal->commission_agent_amount)->toBe(1500.0)
        ->and($deal->commission_manager_amount)->toBe(1000.0)
        ->and($deal->commission_company_amount)->toBe($companyAmount)
        ->and($deal->commission_total_amount)->toBe(2500.0 + $companyAmount)
        ->and($agent->fresh()->totalPotentialCommission)->toBe(1500.0)
        ->and($manager->fresh()->totalPotentialCommission)->toBe(1000.0)
        ->and($agent->fresh()->totalActualCommission)->toBe(0.0)
        ->and(CommissionAllocation::query()->where('deal_id', $deal->id)->count())->toBe(3);
});

test('won deals snapshot final allocations and later edits create a new version', function () {
    $manager = User::factory()->create();
    $agent = User::factory()->create(['direct_manager_id' => $manager->id]);
    $deal = commissionDealFor($agent);

    app(CommissionService::class)->recalculate($deal);
    $deal->update(['status' => DealStatus::WON]);
    app(CommissionService::class)->recalculate($deal);

    $deal->refresh();

    expect($deal->commission_status)->toBe(CommissionAllocationState::FINAL)
        ->and($deal->commission_version)->toBe(2)
        ->and(CommissionAllocation::query()
            ->where('deal_id', $deal->id)
            ->where('version', 1)
            ->where('state', CommissionAllocationState::SUPERSEDED->value)
            ->count())->toBe(3)
        ->and($agent->fresh()->totalPotentialCommission)->toBe(0.0)
        ->and($manager->fresh()->totalPotentialCommission)->toBe(0.0)
        ->and($agent->fresh()->totalActualCommission)->toBe(1500.0)
        ->and($manager->fresh()->totalActualCommission)->toBe(1000.0);

    CommissionPolicy::query()->create([
        'recipient_type' => 'agent',
        'user_id' => $agent->id,
        'rate' => 2,
        'effective_from' => now()->subDay()->toDateString(),
    ]);
    $deal->update(['deal_value' => 200_000]);
    app(CommissionService::class)->recalculate($deal);

    expect($deal->fresh()->commission_version)->toBe(3)
        ->and($deal->fresh()->commission_agent_amount)->toBe(4000.0)
        ->and($deal->fresh()->commission_manager_amount)->toBe(2000.0);
});

test('recalculating an unchanged won deal reuses its final snapshot', function () {
    $agent = User::factory()->create();
    $deal = commissionDealFor($agent);
    $commissionService = app(CommissionService::class);

    $commissionService->recalculate($deal);
    $deal->update(['status' => DealStatus::WON]);
    $commissionService->recalculate($deal);

    $commissionService->recalculate($deal);

    expect($deal->fresh()->commission_version)->toBe(2)
        ->and(CommissionAllocation::query()->where('deal_id', $deal->id)->count())->toBe(4)
        ->and(CommissionAllocation::query()
            ->where('deal_id', $deal->id)
            ->where('version', 2)
            ->where('state', CommissionAllocationState::FINAL->value)
            ->count())->toBe(2)
        ->and($agent->fresh()->totalActualCommission)->toBe(1500.0);
});

test('recalculateForUser handles more than one batch and excludes final deals', function () {
    $manager = User::factory()->create();
    $agent = User::factory()->create(['direct_manager_id' => $manager->id]);
    $seedDeal = commissionDealFor($agent, [
        'status' => DealStatus::INQUIRY,
        'deal_value' => 100_000,
    ]);
    $bulkDeals = Deal::factory()->count(101)->create([
        'value' => 100_000,
        'deal_value' => 100_000,
        'contact_id' => $seedDeal->contact_id,
        'property_id' => $seedDeal->property_id,
        'agent_id' => $agent->id,
        'status' => DealStatus::LEGAL,
        'commission_rate' => 0,
    ]);
    $wonDeal = commissionDealFor($agent, [
        'status' => DealStatus::WON,
        'deal_value' => 200_000,
    ]);
    $commissionService = app(CommissionService::class);

    $commissionService->recalculate($wonDeal);
    $commissionService->recalculateForUser($agent);

    $activeDealCount = $bulkDeals->count() + 1;

    expect(CommissionAllocation::query()
        ->whereIn('deal_id', [...$bulkDeals->pluck('id'), $seedDeal->id])
        ->count())->toBe($activeDealCount * 3)
        ->and($agent->fresh()->totalPotentialCommission)->toBe($activeDealCount * 1500.0)
        ->and($manager->fresh()->totalPotentialCommission)->toBe($activeDealCount * 1000.0)
        ->and($wonDeal->fresh()->commission_version)->toBe(1)
        ->and($agent->fresh()->totalActualCommission)->toBe(3000.0)
        ->and($manager->fresh()->totalActualCommission)->toBe(2000.0);
});

test('a bulk recalculation clears cached policies after its batch', function () {
    $agent = User::factory()->create();
    $deal = commissionDealFor($agent);
    $commissionService = app(CommissionService::class);

    $commissionService->recalculateBatch([$deal]);

    CommissionPolicy::query()->create([
        'recipient_type' => 'agent',
        'user_id' => $agent->id,
        'rate' => 2,
        'effective_from' => now()->subDay()->toDateString(),
    ]);
    $deal->update(['deal_value' => 200_000]);
    $commissionService->recalculate($deal);

    expect($deal->fresh()->commission_agent_amount)->toBe(4000.0);
});

test('the bulk command recalculates active and missing terminal deals only', function () {
    $agent = User::factory()->create();
    $activeDeal = commissionDealFor($agent, ['status' => DealStatus::INQUIRY]);
    $wonDeal = commissionDealFor($agent, ['status' => DealStatus::WON]);
    $lostDeal = commissionDealFor($agent, ['status' => DealStatus::LOST]);
    $commissionService = app(CommissionService::class);

    $commissionService->recalculate($wonDeal);

    $this->artisan('commission:recalculate', ['--all' => true])
        ->assertSuccessful();

    expect($activeDeal->fresh()->commission_version)->toBe(1)
        ->and($wonDeal->fresh()->commission_version)->toBe(1)
        ->and($lostDeal->fresh()->commission_version)->toBe(1)
        ->and($lostDeal->fresh()->commission_status)->toBe(CommissionAllocationState::VOID)
        ->and(CommissionAllocation::query()->where('deal_id', $wonDeal->id)->count())->toBe(2);
});

test('lost and deleted deals do not retain payable commission totals', function () {
    $agent = User::factory()->create();
    $deal = commissionDealFor($agent);
    $commissionService = app(CommissionService::class);

    $commissionService->recalculate($deal);
    $deal->update(['status' => DealStatus::LOST]);
    $commissionService->recalculate($deal);

    expect($deal->fresh()->commission_status)->toBe(CommissionAllocationState::VOID)
        ->and($deal->fresh()->commission_rate)->toBe(1.5)
        ->and($deal->fresh()->commission_total_amount)->toBe(0.0)
        ->and($agent->fresh()->totalPotentialCommission)->toBe(0.0)
        ->and($agent->fresh()->totalActualCommission)->toBe(0.0)
        ->and(CommissionAllocation::query()
            ->where('deal_id', $deal->id)
            ->where('state', CommissionAllocationState::VOID->value)
            ->count())->toBe(2);
});

test('a deal seeded directly as lost still gets resolved void allocations', function () {
    $agent = User::factory()->create();
    $deal = commissionDealFor($agent, ['status' => DealStatus::LOST, 'commission_rate' => 2.5]);

    app(CommissionService::class)->recalculate($deal);

    expect($deal->fresh()->commission_version)->toBe(1)
        ->and($deal->fresh()->commission_rate)->toBe(1.5)
        ->and(CommissionAllocation::query()->where('deal_id', $deal->id)->count())->toBe(2)
        ->and(CommissionAllocation::query()
            ->where('deal_id', $deal->id)
            ->where('state', CommissionAllocationState::VOID->value)
            ->count())->toBe(2)
        ->and($agent->fresh()->totalPotentialCommission)->toBe(0.0)
        ->and($agent->fresh()->totalActualCommission)->toBe(0.0);
});

test('the Deal API exposes the stored commission summary and current allocations', function () {
    $viewer = User::factory()->create(['is_super' => true]);
    $agent = User::factory()->create();
    $deal = commissionDealFor($agent);
    app(CommissionService::class)->recalculate($deal);

    $this->actingAs($viewer)
        ->getJson("/api/v1/deals/{$deal->id}")
        ->assertOk()
        ->assertJsonPath('deal.commission.status', 'estimate')
        ->assertJsonPath('deal.commission.version', 1)
        ->assertJsonPath('deal.commission.agent_amount', 1500)
        ->assertJsonCount(2, 'deal.commission.allocations');
});
