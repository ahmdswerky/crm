<?php

namespace App\Services;

use App\Enums\CommissionRecipientType;
use App\Models\CommissionPolicy;
use App\Models\User;
use Illuminate\Support\Carbon;

class CommissionRateResolver
{
    protected array $resolvedRates = [];

    public function clearCache(): void
    {
        $this->resolvedRates = [];
    }

    public function resolve(CommissionRecipientType $recipientType, ?User $user, ?Carbon $date = null): array
    {
        $date ??= now();
        $cacheKey = implode(':', [
            $recipientType->value,
            $user?->id ?? 'company',
            $date->toDateString(),
        ]);

        if (isset($this->resolvedRates[$cacheKey])) {
            return $this->resolvedRates[$cacheKey];
        }

        $policy = CommissionPolicy::query()
            ->where('recipient_type', $recipientType->value)
            ->when($recipientType === CommissionRecipientType::COMPANY,
                fn ($query) => $query->whereNull('user_id'),
                fn ($query) => $query->where('user_id', $user?->id),
            )
            ->whereDate('effective_from', '<=', $date)
            ->where(function ($query) use ($date): void {
                $query
                    ->whereNull('effective_to')
                    ->orWhereDate('effective_to', '>=', $date);
            })
            ->latest('effective_from')
            ->first();

        if ($policy) {
            return $this->resolvedRates[$cacheKey] = [
                'rate' => (float) $policy->rate,
                'policy_id' => $policy->id,
            ];
        }

        $configKey = match ($recipientType) {
            CommissionRecipientType::AGENT => 'agent',
            CommissionRecipientType::MANAGER => 'manager',
            CommissionRecipientType::COMPANY => 'company',
        };

        return $this->resolvedRates[$cacheKey] = [
            'rate' => (float) config("crm.commission_rates.{$configKey}", 0),
            'policy_id' => null,
        ];
    }
}
