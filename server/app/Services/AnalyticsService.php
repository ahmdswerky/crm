<?php

namespace App\Services;

use App\Enums\CommissionAllocationState;
use App\Enums\DealStatus;
use App\Models\CommissionAllocation;
use App\Models\Contact;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Property;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

class AnalyticsService
{
    /** @return array<string, mixed> */
    public function overview(): array
    {
        $now = now('UTC');

        return [
            'as_of' => $now->toIso8601String(),
            'today' => $this->summary($now->copy()->startOfDay(), $now),
            'month_to_date' => $this->summary($now->copy()->startOfMonth(), $now),
            'pipeline' => $this->pipeline(),
            'inventory' => $this->inventory(),
        ];
    }

    /** @return array<string, mixed> */
    public function salesPipelineReport(CarbonInterface $start, CarbonInterface $end): array
    {
        return [
            'period' => [
                'start' => $start->toIso8601String(),
                'end' => $end->toIso8601String(),
                'timezone' => 'UTC',
            ],
            'summary' => $this->summary($start, $end),
            'pipeline' => $this->pipeline(),
            'agent_performance' => $this->agentPerformance($start, $end),
            'inventory' => $this->inventory(),
        ];
    }

    /** @return array<string, int|float> */
    private function summary(CarbonInterface $start, CarbonInterface $end): array
    {
        $leadCount = $this->inPeriod(Lead::query(), 'created_at', $start, $end)->count();
        $convertedLeads = $this->inPeriod(Contact::query()->whereNotNull('lead_id'), 'created_at', $start, $end)->count();
        $closed = $this->inPeriod(Deal::query()->whereIn('status', [DealStatus::WON->value, DealStatus::LOST->value]), 'closed_at', $start, $end)
            ->selectRaw('COUNT(*) as total, COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) as won_count, COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) as lost_count, COALESCE(SUM(CASE WHEN status = ? THEN deal_value ELSE 0 END), 0) as won_value, COALESCE(SUM(CASE WHEN status = ? THEN deal_value ELSE 0 END), 0) as lost_value', [DealStatus::WON->value, DealStatus::LOST->value, DealStatus::WON->value, DealStatus::LOST->value])
            ->first();
        $commission = $this->inPeriod(CommissionAllocation::query()->where('state', CommissionAllocationState::FINAL->value), 'created_at', $start, $end)
            ->selectRaw('COALESCE(SUM(amount), 0) as total')
            ->value('total');
        $openedDeals = $this->inPeriod(Deal::query(), 'created_at', $start, $end)
            ->selectRaw('COUNT(*) as total, COALESCE(SUM(deal_value), 0) as value')
            ->first();

        return [
            'new_leads' => $leadCount,
            'converted_leads' => $convertedLeads,
            'lead_conversion_rate' => $leadCount === 0 ? 0.0 : round($convertedLeads / $leadCount * 100, 2),
            'opened_deals' => (int) ($openedDeals->total ?? 0),
            'opened_deal_value' => (float) ($openedDeals->value ?? 0),
            'won_deals' => (int) ($closed->won_count ?? 0),
            'lost_deals' => (int) ($closed->lost_count ?? 0),
            'won_value' => (float) ($closed->won_value ?? 0),
            'lost_value' => (float) ($closed->lost_value ?? 0),
            'win_rate' => (int) ($closed->total ?? 0) === 0 ? 0.0 : round((int) $closed->won_count / (int) $closed->total * 100, 2),
            'final_commission' => (float) $commission,
        ];
    }

    /** @return array<string, mixed> */
    private function pipeline(): array
    {
        $statuses = array_map(static fn (DealStatus $status): string => $status->value, DealStatus::cases());
        $rows = Deal::query()
            ->selectRaw('status, COUNT(*) as count, COALESCE(SUM(deal_value), 0) as value')
            ->groupBy('status')
            ->get()
            ->keyBy('status');
        $activeStatuses = [DealStatus::INQUIRY->value, DealStatus::VIEWING->value, DealStatus::OFFER_MADE->value, DealStatus::LEGAL->value];

        return [
            'active_count' => (int) Deal::query()->whereIn('status', $activeStatuses)->count(),
            'active_value' => (float) Deal::query()->whereIn('status', $activeStatuses)->sum('deal_value'),
            'by_status' => array_map(static fn (string $status): array => [
                'status' => $status,
                'count' => (int) ($rows->get($status)?->count ?? 0),
                'value' => (float) ($rows->get($status)?->value ?? 0),
            ], $statuses),
        ];
    }

    /** @return array<int, array<string, int|float|string|null>> */
    private function agentPerformance(CarbonInterface $start, CarbonInterface $end): array
    {
        $leads = $this->inPeriod(Lead::query()->whereNotNull('assigned_agent_id'), 'created_at', $start, $end)
            ->selectRaw('assigned_agent_id as user_id, COUNT(*) as leads_assigned')
            ->groupBy('assigned_agent_id')
            ->pluck('leads_assigned', 'user_id');
        $deals = $this->inPeriod(Deal::query(), 'created_at', $start, $end)
            ->selectRaw('agent_id as user_id, COUNT(*) as opened_deals, COALESCE(SUM(deal_value), 0) as opened_value')
            ->groupBy('agent_id')
            ->get()
            ->keyBy('user_id');
        $wins = $this->inPeriod(Deal::query()->where('status', DealStatus::WON->value), 'closed_at', $start, $end)
            ->selectRaw('agent_id as user_id, COUNT(*) as won_deals, COALESCE(SUM(deal_value), 0) as won_value')
            ->groupBy('agent_id')
            ->get()
            ->keyBy('user_id');
        $ids = collect([$leads->keys(), $deals->keys(), $wins->keys()])->flatten()->unique()->filter()->values();

        return User::query()->whereIn('id', $ids)->orderBy('name')->get(['id', 'name'])->map(static function (User $user) use ($leads, $deals, $wins): array {
            $deal = $deals->get($user->id);
            $win = $wins->get($user->id);

            return [
                'agent_id' => $user->id,
                'agent_name' => $user->name,
                'leads_assigned' => (int) ($leads->get($user->id) ?? 0),
                'opened_deals' => (int) ($deal?->opened_deals ?? 0),
                'opened_value' => (float) ($deal?->opened_value ?? 0),
                'won_deals' => (int) ($win?->won_deals ?? 0),
                'won_value' => (float) ($win?->won_value ?? 0),
            ];
        })->all();
    }

    /** @return array<int, array<string, int|float|string|null>> */
    private function inventory(): array
    {
        return Property::query()
            ->selectRaw('status, purpose, type, COUNT(*) as count, COALESCE(SUM(price), 0) as value')
            ->groupBy('status', 'purpose', 'type')
            ->orderBy('status')->orderBy('purpose')->orderBy('type')
            ->get()
            ->map(static fn (Property $property): array => [
                'status' => $property->getRawOriginal('status'),
                'purpose' => $property->getRawOriginal('purpose'),
                'type' => $property->getRawOriginal('type'),
                'count' => (int) $property->getAttribute('count'),
                'value' => (float) $property->getAttribute('value'),
            ])->all();
    }

    private function inPeriod(Builder $query, string $column, CarbonInterface $start, CarbonInterface $end): Builder
    {
        return $query->where($column, '>=', $start)->where($column, '<', $end);
    }
}
