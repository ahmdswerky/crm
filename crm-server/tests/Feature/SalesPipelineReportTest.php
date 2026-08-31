<?php

use App\Enums\PropertyPurpose;
use App\Enums\PropertyStatus;
use App\Enums\PropertyType;
use App\Models\Account;
use App\Models\Contact;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Property;
use App\Models\User;
use App\Services\AnalyticsService;
use Carbon\Carbon;

/** @return array{agent: User, contact: Contact, property: Property} */
function salesPipelineReportContext(): array
{
    $agent = User::factory()->create();
    $account = Account::factory()->create();
    $lead = Lead::factory()->create(['assigned_agent_id' => $agent->id]);
    $contact = Contact::query()->create([
        'account_id' => $account->id,
        'lead_id' => $lead->id,
        'name' => $lead->name,
        'email' => $lead->email,
        'phone' => $lead->phone,
        'assigned_agent_id' => $agent->id,
    ]);
    $property = Property::query()->create([
        'created_by' => $agent->id,
        'title' => fake()->unique()->sentence(3),
        'description' => 'A property used to verify report pipeline ranges.',
        'city' => 'Cairo',
        'price' => 500_000,
        'purpose' => PropertyPurpose::SALE,
        'type' => PropertyType::VILLA,
        'status' => PropertyStatus::PENDING,
    ]);

    return compact('agent', 'contact', 'property');
}

/** @param array{agent: User, contact: Contact, property: Property} $context */
function salesPipelineReportDeal(array $context, string $status, float $value, ?string $statusUpdatedAt = null): Deal
{
    $deal = Deal::query()->create([
        'value' => $value,
        'deal_value' => $value,
        'contact_id' => $context['contact']->id,
        'property_id' => $context['property']->id,
        'agent_id' => $context['agent']->id,
        'status' => $status,
        'commission_rate' => 2.5,
    ]);

    if ($statusUpdatedAt !== null) {
        $deal->forceFill(['status_updated_at' => $statusUpdatedAt])->saveQuietly();
    }

    return $deal;
}

test('a deal records when its current status was entered', function () {
    Carbon::setTestNow('2026-08-10 09:00:00 UTC');

    try {
        $context = salesPipelineReportContext();
        $deal = salesPipelineReportDeal($context, 'inquiry', 100_000);
        expect($deal->status_updated_at->toIso8601String())->toBe('2026-08-10T09:00:00+00:00');

        Carbon::setTestNow('2026-08-10 10:00:00 UTC');
        $deal->update(['deal_value' => 110_000]);
        expect($deal->refresh()->status_updated_at->toIso8601String())->toBe('2026-08-10T09:00:00+00:00');

        Carbon::setTestNow('2026-08-10 11:00:00 UTC');
        $deal->update(['status' => 'viewing']);
        expect($deal->refresh()->status_updated_at->toIso8601String())->toBe('2026-08-10T11:00:00+00:00');
    } finally {
        Carbon::setTestNow();
    }
});

test('sales pipeline reports include only statuses entered inside their period', function () {
    $context = salesPipelineReportContext();

    salesPipelineReportDeal($context, 'inquiry', 100_000, '2026-08-10 00:00:00 UTC');
    salesPipelineReportDeal($context, 'viewing', 200_000, '2026-08-12 12:00:00 UTC');
    salesPipelineReportDeal($context, 'won', 300_000, '2026-08-11 10:00:00 UTC');
    salesPipelineReportDeal($context, 'legal', 400_000, '2026-08-13 00:00:00 UTC');
    salesPipelineReportDeal($context, 'offer_made', 500_000, '2026-08-09 23:59:59 UTC');

    $snapshot = app(AnalyticsService::class)->salesPipelineReport(
        Carbon::parse('2026-08-10 00:00:00 UTC'),
        Carbon::parse('2026-08-13 00:00:00 UTC'),
    );
    $rows = collect($snapshot['pipeline']['by_status'])->keyBy('status');

    expect($snapshot['pipeline']['active_count'])->toBe(2)
        ->and($snapshot['pipeline']['active_value'])->toBe(300_000.0)
        ->and($rows['inquiry']['count'])->toBe(1)
        ->and($rows['viewing']['value'])->toBe(200_000.0)
        ->and($rows['won']['count'])->toBe(1)
        ->and($rows['legal']['count'])->toBe(0)
        ->and($rows['offer_made']['count'])->toBe(0);

    $overview = app(AnalyticsService::class)->overview();
    expect($overview['pipeline']['active_count'])->toBe(4)
        ->and($overview['pipeline']['active_value'])->toBe(1_200_000.0);
});
