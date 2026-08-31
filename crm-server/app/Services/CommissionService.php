<?php

namespace App\Services;

use App\Enums\CommissionAllocationState;
use App\Enums\CommissionRecipientType;
use App\Enums\DealStatus;
use App\Models\CommissionAllocation;
use App\Models\Deal;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CommissionService
{
    public function __construct(protected readonly CommissionRateResolver $rateResolver) {}

    public function recalculate(Deal $deal): Deal
    {
        try {
            return $this->recalculateDeal(
                $deal,
                function (array $userIds): void {
                    $this->refreshUserCommissionTotals($userIds);
                },
            );
        } finally {
            $this->rateResolver->clearCache();
        }
    }

    public function recalculateBatch(iterable $deals): void
    {
        $affectedUserIds = [];

        try {
            foreach ($deals as $deal) {
                $this->recalculateDeal(
                    $deal,
                    function (array $userIds) use (&$affectedUserIds): void {
                        $affectedUserIds = array_values(array_unique([
                            ...$affectedUserIds,
                            ...$userIds,
                        ]));
                    },
                    false,
                );
            }

            $this->refreshUserCommissionTotals($affectedUserIds);
        } finally {
            $this->rateResolver->clearCache();
        }
    }

    protected function recalculateDeal(
        Deal $deal,
        callable $refreshTotals,
        bool $fresh = true,
    ): Deal {
        $deal = Deal::query()->lockForUpdate()->findOrFail($deal->id);

        if ($deal->status === DealStatus::LOST) {
            return $this->voidDealInternal($deal, $refreshTotals, $fresh);
        }

        $agent = User::query()->findOrFail($deal->agent_id);
        $manager = $agent->direct_manager_id
            ? User::query()->find($agent->direct_manager_id)
            : null;
        $affectedUserIds = $this->recipientUserIdsForDeal($deal->id);
        $affectedUserIds = array_values(array_unique([
            ...$affectedUserIds,
            $agent->id,
            ...($manager ? [$manager->id] : []),
        ]));
        $isFinal = $deal->status === DealStatus::WON;
        $currentState = $this->currentState($deal);
        $version = max(0, (int) $deal->commission_version);
        $canReuseFinalSnapshot = $isFinal
            && $currentState === CommissionAllocationState::FINAL
            && $this->allocationsMatchCurrentVersion($deal, $version, $agent, $manager);

        if ($version === 0) {
            $version = 1;
        } elseif (! $canReuseFinalSnapshot && ($isFinal || in_array($currentState, [
            CommissionAllocationState::FINAL,
            CommissionAllocationState::VOID,
        ], true))) {
            $version++;
        }

        if (! $canReuseFinalSnapshot && $version > 1 && ($isFinal || $currentState === CommissionAllocationState::FINAL)) {
            $this->supersedeCurrent($deal);
        }

        if ($canReuseFinalSnapshot) {
            $refreshTotals($affectedUserIds);

            return $fresh ? $deal->fresh() : $deal;
        }

        $snapshotDate = Carbon::now();
        $allocations = collect([
            $this->allocationData($deal, $version, CommissionRecipientType::AGENT, $agent, $snapshotDate),
            $manager ? $this->allocationData($deal, $version, CommissionRecipientType::MANAGER, $manager, $snapshotDate) : null,
            $this->allocationData($deal, $version, CommissionRecipientType::COMPANY, null, $snapshotDate),
        ])->filter()->values();

        $state = $isFinal ? CommissionAllocationState::FINAL : CommissionAllocationState::ESTIMATE;

        foreach ($allocations as $allocation) {
            CommissionAllocation::query()->updateOrCreate(
                [
                    'deal_id' => $deal->id,
                    'version' => $version,
                    'recipient_type' => $allocation['recipient_type'],
                ],
                [...$allocation, 'state' => $state->value],
            );
        }

        CommissionAllocation::query()
            ->where('deal_id', $deal->id)
            ->where('version', $version)
            ->whereNotIn('recipient_type', $allocations->pluck('recipient_type')->all())
            ->whereIn('state', [
                CommissionAllocationState::ESTIMATE->value,
                CommissionAllocationState::FINAL->value,
            ])
            ->update(['state' => CommissionAllocationState::SUPERSEDED->value]);

        $deal->forceFill([
            'commission_version' => $version,
            'commission_status' => $state->value,
            'commission_rate' => $allocations->firstWhere('recipient_type', CommissionRecipientType::AGENT->value)['rate'],
            'commission_agent_amount' => $allocations->firstWhere('recipient_type', CommissionRecipientType::AGENT->value)['amount'],
            'commission_manager_amount' => $allocations->firstWhere('recipient_type', CommissionRecipientType::MANAGER->value)['amount'] ?? 0,
            'commission_company_amount' => $allocations->firstWhere('recipient_type', CommissionRecipientType::COMPANY->value)['amount'],
            'commission_total_amount' => $allocations->sum('amount'),
            'commission_calculated_at' => $snapshotDate,
            'commission_finalized_at' => $isFinal ? $snapshotDate : null,
        ])->save();

        $refreshTotals($affectedUserIds);

        return $fresh ? $deal->fresh() : $deal;
    }

    public function recalculateForUser(User $user): void
    {
        Deal::query()
            ->select('deals.id')
            ->where(function ($query) use ($user): void {
                $query
                    ->where('agent_id', $user->id)
                    ->orWhereHas('agent', fn ($agent) => $agent->where('direct_manager_id', $user->id));
            })
            ->whereIn('status', [
                DealStatus::INQUIRY->value,
                DealStatus::VIEWING->value,
                DealStatus::OFFER_MADE->value,
                DealStatus::LEGAL->value,
            ])
            ->orderBy('deals.id')
            ->chunkById(100, function (Collection $deals): void {
                DB::transaction(function () use ($deals): void {
                    $this->recalculateBatch($deals);
                }, 3);
            });
    }

    public function voidDeal(Deal $deal): Deal
    {
        try {
            return $this->voidDealInternal(
                $deal,
                function (array $userIds): void {
                    $this->refreshUserCommissionTotals($userIds);
                },
            );
        } finally {
            $this->rateResolver->clearCache();
        }
    }

    /** @param callable(array<int, int>): void $refreshTotals */
    protected function voidDealInternal(
        Deal $deal,
        callable $refreshTotals,
        bool $fresh = true,
    ): Deal {
        $affectedUserIds = $this->recipientUserIdsForDeal($deal->id);
        $agent = User::query()->findOrFail($deal->agent_id);
        $manager = $agent->direct_manager_id
            ? User::query()->find($agent->direct_manager_id)
            : null;
        $version = max(1, (int) $deal->commission_version);
        $snapshotDate = Carbon::now();
        $allocations = collect([
            $this->allocationData($deal, $version, CommissionRecipientType::AGENT, $agent, $snapshotDate),
            $manager ? $this->allocationData($deal, $version, CommissionRecipientType::MANAGER, $manager, $snapshotDate) : null,
            $this->allocationData($deal, $version, CommissionRecipientType::COMPANY, null, $snapshotDate),
        ])->filter()->values();

        $affectedUserIds = array_values(array_unique([
            ...$affectedUserIds,
            $agent->id,
            ...($manager ? [$manager->id] : []),
        ]));

        CommissionAllocation::query()
            ->where('deal_id', $deal->id)
            ->whereIn('state', [
                CommissionAllocationState::ESTIMATE->value,
                CommissionAllocationState::FINAL->value,
            ])
            ->update(['state' => CommissionAllocationState::VOID->value]);

        foreach ($allocations as $allocation) {
            CommissionAllocation::query()->updateOrCreate(
                [
                    'deal_id' => $deal->id,
                    'version' => $version,
                    'recipient_type' => $allocation['recipient_type'],
                ],
                [...$allocation, 'state' => CommissionAllocationState::VOID->value],
            );
        }

        $deal->forceFill([
            'commission_version' => $version,
            'commission_status' => CommissionAllocationState::VOID->value,
            'commission_rate' => $allocations->firstWhere('recipient_type', CommissionRecipientType::AGENT->value)['rate'],
            'commission_agent_amount' => 0,
            'commission_manager_amount' => 0,
            'commission_company_amount' => 0,
            'commission_total_amount' => 0,
            'commission_calculated_at' => $snapshotDate,
            'commission_finalized_at' => null,
        ])->save();

        $refreshTotals($affectedUserIds);

        return $fresh ? $deal->fresh() : $deal;
    }

    protected function allocationsMatchCurrentVersion(
        Deal $deal,
        int $version,
        User $agent,
        ?User $manager,
    ): bool {
        $snapshotDate = Carbon::now();
        $expected = collect([
            $this->allocationData($deal, $version, CommissionRecipientType::AGENT, $agent, $snapshotDate),
            $manager ? $this->allocationData($deal, $version, CommissionRecipientType::MANAGER, $manager, $snapshotDate) : null,
            $this->allocationData($deal, $version, CommissionRecipientType::COMPANY, null, $snapshotDate),
        ])->filter()->values();

        $current = CommissionAllocation::query()
            ->where('deal_id', $deal->id)
            ->where('version', $version)
            ->get()
            ->keyBy(fn (CommissionAllocation $allocation): string => (string) $allocation->getRawOriginal('recipient_type'));

        if ($current->count() !== $expected->count()) {
            return false;
        }

        foreach ($expected as $allocation) {
            $existing = $current->get($allocation['recipient_type']);

            if (! $existing
                || (int) $existing->recipient_user_id !== (int) ($allocation['recipient_user_id'] ?? 0)
                || (int) $existing->commission_policy_id !== (int) ($allocation['commission_policy_id'] ?? 0)
                || ! $this->sameAmount($existing->base_amount, $allocation['base_amount'])
                || ! $this->sameAmount($existing->rate, $allocation['rate'])
                || ! $this->sameAmount($existing->amount, $allocation['amount'])) {
                return false;
            }
        }

        return true;
    }

    protected function sameAmount(float|int|null $left, float|int|null $right): bool
    {
        return abs((float) $left - (float) $right) < 0.0001;
    }

    /** @return array<int, int> */
    protected function recipientUserIdsForDeal(int $dealId): array
    {
        return CommissionAllocation::query()
            ->where('deal_id', $dealId)
            ->whereNotNull('recipient_user_id')
            ->pluck('recipient_user_id')
            ->map(fn ($id): int => (int) $id)
            ->all();
    }

    /** @param array<int, int> $userIds */
    protected function refreshUserCommissionTotals(array $userIds): void
    {
        $userIds = array_values(array_unique(array_map('intval', $userIds)));

        if ($userIds === []) {
            return;
        }

        $totals = DB::table('commission_allocations')
            ->select('recipient_user_id', 'state')
            ->selectRaw('SUM(amount) AS total')
            ->whereIn('recipient_user_id', $userIds)
            ->whereIn('state', [
                CommissionAllocationState::ESTIMATE->value,
                CommissionAllocationState::FINAL->value,
            ])
            ->groupBy('recipient_user_id', 'state')
            ->get();

        $values = [];
        foreach ($userIds as $userId) {
            $values[$userId] = [
                'total_potential_commission' => 0,
                'total_actual_commission' => 0,
            ];
        }

        foreach ($totals as $total) {
            $userId = (int) $total->recipient_user_id;
            $column = $total->state === CommissionAllocationState::FINAL->value
                ? 'total_actual_commission'
                : 'total_potential_commission';

            if (isset($values[$userId])) {
                $values[$userId][$column] = round((float) $total->total, 2);
            }
        }

        foreach ($values as $userId => $totalsForUser) {
            User::query()
                ->whereKey($userId)
                ->update($totalsForUser);
        }
    }

    protected function supersedeCurrent(Deal $deal): void
    {
        CommissionAllocation::query()
            ->where('deal_id', $deal->id)
            ->where('version', $deal->commission_version)
            ->whereIn('state', [
                CommissionAllocationState::ESTIMATE->value,
                CommissionAllocationState::FINAL->value,
            ])
            ->update(['state' => CommissionAllocationState::SUPERSEDED->value]);
    }

    protected function currentState(Deal $deal): ?CommissionAllocationState
    {
        $state = CommissionAllocation::query()
            ->where('deal_id', $deal->id)
            ->where('version', $deal->commission_version)
            ->value('state');

        return $state instanceof CommissionAllocationState
            ? $state
            : ($state ? CommissionAllocationState::from((string) $state) : null);
    }

    /** @return array<string, mixed> */
    protected function allocationData(
        Deal $deal,
        int $version,
        CommissionRecipientType $recipientType,
        ?User $user,
        Carbon $snapshotDate,
    ): array {
        $policy = $this->rateResolver->resolve($recipientType, $user, $snapshotDate);
        $baseAmount = (float) $deal->deal_value;
        $rate = $policy['rate'];

        return [
            'deal_id' => $deal->id,
            'version' => $version,
            'recipient_type' => $recipientType->value,
            'recipient_user_id' => $user?->id,
            'commission_policy_id' => $policy['policy_id'],
            'base_amount' => $baseAmount,
            'rate' => $rate,
            'amount' => round($baseAmount * $rate / 100, 2),
            'snapshotted_at' => $snapshotDate,
        ];
    }
}
