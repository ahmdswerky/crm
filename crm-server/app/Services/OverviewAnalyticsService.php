<?php

namespace App\Services;

use App\Enums\DealStatus;
use App\Http\Resources\MediaResource;
use App\Models\Account;
use App\Models\Contact;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Property;
use App\Models\User;
use Carbon\CarbonInterface;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class OverviewAnalyticsService
{
    private const CACHE_TTL_SECONDS = 30;

    /** @var array<int, string> */
    private const RANGES = ['year', 'month', 'week'];

    /** @return array<string, mixed> */
    public function metrics(): array
    {
        return $this->remember('metrics', fn (): array => $this->buildMetrics(now('UTC')));
    }

    /** @return array{range: string, data: array<int, array{name: string, value: float}>} */
    public function leaderboard(string $range): array
    {
        $this->assertRange($range);

        return $this->remember("leaderboard:{$range}", fn (): array => [
            'range' => $range,
            'data' => $this->buildLeaderboard($range, now('UTC')),
        ]);
    }

    /** @return array{range: string, current: array<int, array{label: string, value: float}>, previous: array<int, array{label: string, value: float}>} */
    public function revenue(string $range): array
    {
        $this->assertRange($range);

        return $this->remember("revenue:{$range}", fn (): array => [
            'range' => $range,
            ...$this->buildRevenue($range, now('UTC')),
        ]);
    }

    /** @return array<int, array{id: int, name: string, company: string|null, account_logo: string|null, position: string|null}> */
    public function customers(): array
    {
        return $this->remember('customers', fn (): array => Lead::query()
            ->qualified()
            ->select(['id', 'name', 'company_name', 'created_at'])
            ->with(['contact:id,lead_id,account_id,title', 'contact.account:id,name', 'contact.account.media'])
            ->latest('created_at')
            ->limit(5)
            ->get()
            ->map(function (Lead $lead): array {
                $account = $lead->contact?->account;

                return [
                    'id' => $lead->id,
                    'name' => $lead->name,
                    'company' => $account?->name ?? $lead->company_name,
                    'account_logo' => $this->mediaUrl($account?->getFirstMedia('main')),
                    'position' => $lead->contact?->title,
                ];
            })
            ->all());
    }

    /** @return array<int, array{id: int, name: string, customer: string|null, deal_value: float, status: string}> */
    public function deals(): array
    {
        return $this->remember('deals', fn (): array => Deal::query()
            ->select(['id', 'contact_id', 'property_id', 'deal_value', 'status', 'created_at'])
            ->with(['contact:id,name', 'property:id,title'])
            ->latest('created_at')
            ->limit(5)
            ->get()
            ->map(static fn (Deal $deal): array => [
                'id' => $deal->id,
                'name' => $deal->property?->title ?? 'Untitled property',
                'customer' => $deal->contact?->name,
                'deal_value' => (float) $deal->deal_value,
                'status' => $deal->status->value,
            ])
            ->all());
    }

    /** @return array<int, array{id: int, name: string, logo: string|null, industry: string|null, leads_count: int}> */
    public function accounts(): array
    {
        return $this->remember('accounts', fn (): array => Account::query()
            ->select(['id', 'name', 'industry', 'created_at'])
            ->with('media')
            ->withCount('contacts as leads_count')
            ->orderByDesc('leads_count')
            ->latest('created_at')
            ->limit(5)
            ->get()
            ->map(fn (Account $account): array => [
                'id' => $account->id,
                'name' => $account->name,
                'logo' => $this->mediaUrl($account->getFirstMedia('main')),
                'industry' => $account->industry,
                'leads_count' => (int) $account->leads_count,
            ])
            ->all());
    }

    /** @return array<int, array{id: int, name: string, status: string, price: float}> */
    public function properties(): array
    {
        return $this->remember('properties', fn (): array => Property::query()
            ->select(['id', 'title', 'status', 'price', 'created_at'])
            ->latest('created_at')
            ->limit(5)
            ->get()
            ->map(static fn (Property $property): array => [
                'id' => $property->id,
                'name' => $property->title,
                'status' => $property->status->value,
                'price' => (float) $property->price,
            ])
            ->all());
    }

    public function forgetAll(): void
    {
        foreach (['metrics', 'customers', 'deals', 'accounts', 'properties'] as $key) {
            $this->cache()->forget($this->cacheKey($key));
        }

        foreach (self::RANGES as $range) {
            $this->cache()->forget($this->cacheKey("leaderboard:{$range}"));
            $this->cache()->forget($this->cacheKey("revenue:{$range}"));
        }
    }

    /** @return array<string, mixed> */
    private function buildMetrics(CarbonInterface $now): array
    {
        $monthStart = $now->copy()->startOfMonth();
        $previousMonthStart = $monthStart->copy()->subMonth();
        $dayStart = $now->copy()->startOfDay()->subDays(6);
        $dayEnd = $now->copy()->addDay();
        $leadCounts = $this->groupedCounts(Lead::query(), 'created_at', $previousMonthStart, $now, 'day');
        $conversionCounts = $this->groupedCounts(Contact::query(), 'created_at', $previousMonthStart, $now, 'day');
        $revenue = $this->groupedSums(Deal::query()->where('status', DealStatus::WON->value), 'closed_at', 'deal_value', $previousMonthStart, $now, 'day');
        $propertyCounts = $this->groupedCounts(Property::query(), 'created_at', $previousMonthStart, $dayEnd, 'day');
        $propertyTotals = Property::query()
            ->selectRaw('COUNT(*) as current_count, COALESCE(SUM(CASE WHEN created_at < ? THEN 1 ELSE 0 END), 0) as previous_count', [$monthStart])
            ->first();

        $currentNewLeads = $this->sumPeriod($leadCounts, $monthStart, $now, 'day');
        $previousNewLeads = $this->sumPeriod($leadCounts, $previousMonthStart, $monthStart, 'day');
        $currentConversions = $this->sumPeriod($conversionCounts, $monthStart, $now, 'day');
        $previousConversions = $this->sumPeriod($conversionCounts, $previousMonthStart, $monthStart, 'day');
        $currentRevenue = $this->sumPeriod($revenue, $monthStart, $now, 'day');
        $previousRevenue = $this->sumPeriod($revenue, $previousMonthStart, $monthStart, 'day');

        return [
            'new_leads' => $this->metric($currentNewLeads, $previousNewLeads, $this->trend($leadCounts, $dayStart, 'day')),
            'conversion_rate' => $this->metric(
                $this->rate($currentConversions, $currentNewLeads),
                $this->rate($previousConversions, $previousNewLeads),
                $this->conversionTrend($conversionCounts, $leadCounts, $dayStart),
            ),
            'revenue' => $this->metric($currentRevenue, $previousRevenue, $this->trend($revenue, $dayStart, 'day')),
            'properties' => $this->metric(
                (int) ($propertyTotals?->current_count ?? 0),
                (int) ($propertyTotals?->previous_count ?? 0),
                $this->trend($propertyCounts, $dayStart, 'day'),
            ),
        ];
    }

    /** @return array<int, array{name: string, value: float}> */
    private function buildLeaderboard(string $range, CarbonInterface $now): array
    {
        $periods = $this->chartPeriods($range, $now);

        return User::query()
            ->agents()
            ->whereNull('users.deleted_at')
            ->leftJoin('deals', function ($join) use ($periods): void {
                $join->on('deals.agent_id', '=', 'users.id')
                    ->where('deals.status', DealStatus::WON->value)
                    ->where('deals.closed_at', '>=', $periods[0]['start'])
                    ->where('deals.closed_at', '<', $periods[array_key_last($periods)]['end']);
            })
            ->selectRaw('users.name as name, COALESCE(SUM(deals.deal_value), 0) as value')
            ->groupBy('users.id', 'users.name')
            ->orderByDesc('value')
            ->orderBy('users.name')
            ->get()
            ->map(static fn ($row): array => ['name' => $row->name, 'value' => (float) $row->value])
            ->all();
    }

    /** @return array{current: array<int, array{label: string, value: float}>, previous: array<int, array{label: string, value: float}>} */
    private function buildRevenue(string $range, CarbonInterface $now): array
    {
        $periods = $this->chartPeriods($range, $now);
        $unit = $range === 'year' ? 'month' : 'day';
        $values = $this->groupedSums(
            Deal::query()->where('status', DealStatus::WON->value),
            'closed_at',
            'deal_value',
            $periods[0]['previous_start'],
            $periods[array_key_last($periods)]['end'],
            $unit,
        );

        return [
            'current' => array_map(fn (array $period): array => ['label' => $period['label'], 'value' => $this->sumPeriod($values, $period['start'], $period['end'], $unit)], $periods),
            'previous' => array_map(fn (array $period): array => ['label' => $period['label'], 'value' => $this->sumPeriod($values, $period['previous_start'], $period['previous_end'], $unit)], $periods),
        ];
    }

    /** @return array{value: int|float, change: float, trend: array<int, array{label: string, value: int|float}>} */
    private function metric(int|float $value, int|float $previous, array $trend): array
    {
        return ['value' => $value, 'change' => $this->percentageChange($value, $previous), 'trend' => $trend];
    }

    private function rate(int|float $numerator, int|float $denominator): float
    {
        return (float) $denominator === 0.0 ? 0.0 : round($numerator / $denominator * 100, 2);
    }

    private function percentageChange(int|float $value, int|float $previous): float
    {
        return $previous == 0 ? ($value == 0 ? 0.0 : 100.0) : round(($value - $previous) / $previous * 100, 1);
    }

    /** @param array<string, int|float> $values @return array<int, array{label: string, value: int|float}> */
    private function trend(array $values, CarbonInterface $start, string $unit): array
    {
        $trend = [];
        for ($offset = 0; $offset < 7; $offset++) {
            $date = $start->copy()->addDays($offset);
            $trend[] = ['label' => $date->format('D'), 'value' => $values[$this->bucketKey($date, $unit)] ?? 0];
        }

        return $trend;
    }

    /** @param array<string, int> $conversions @param array<string, int> $leads @return array<int, array{label: string, value: float}> */
    private function conversionTrend(array $conversions, array $leads, CarbonInterface $start): array
    {
        $trend = [];
        for ($offset = 0; $offset < 7; $offset++) {
            $date = $start->copy()->addDays($offset);
            $key = $this->bucketKey($date, 'day');
            $trend[] = ['label' => $date->format('D'), 'value' => $this->rate($conversions[$key] ?? 0, $leads[$key] ?? 0)];
        }

        return $trend;
    }

    /** @return array<string, int> */
    private function groupedCounts(Builder $query, string $column, CarbonInterface $start, CarbonInterface $end, string $unit): array
    {
        $expression = $this->bucketExpression($column, $unit);

        return $query->where($column, '>=', $start)->where($column, '<', $end)
            ->selectRaw("{$expression} as bucket, COUNT(*) as aggregate")->groupByRaw($expression)
            ->pluck('aggregate', 'bucket')->map(static fn ($value): int => (int) $value)->all();
    }

    /** @return array<string, float> */
    private function groupedSums(Builder $query, string $dateColumn, string $valueColumn, CarbonInterface $start, CarbonInterface $end, string $unit): array
    {
        $expression = $this->bucketExpression($dateColumn, $unit);

        return $query->where($dateColumn, '>=', $start)->where($dateColumn, '<', $end)
            ->selectRaw("{$expression} as bucket, COALESCE(SUM({$valueColumn}), 0) as aggregate")->groupByRaw($expression)
            ->pluck('aggregate', 'bucket')->map(static fn ($value): float => (float) $value)->all();
    }

    /** @param array<string, int|float> $values */
    private function sumPeriod(array $values, CarbonInterface $start, CarbonInterface $end, string $unit): float
    {
        $sum = 0.0;
        $cursor = $start->copy()->startOfDay();
        while ($cursor->lt($end)) {
            $sum += $values[$this->bucketKey($cursor, $unit)] ?? 0;
            $cursor = $unit === 'month' ? $cursor->addMonth() : $cursor->addDay();
        }

        return $sum;
    }

    /** @return array<int, array{label: string, start: CarbonInterface, end: CarbonInterface, previous_start: CarbonInterface, previous_end: CarbonInterface}> */
    private function chartPeriods(string $range, CarbonInterface $now): array
    {
        $periods = [];
        if ($range === 'year') {
            $first = $now->copy()->startOfMonth()->subMonths(11);
            for ($offset = 0; $offset < 12; $offset++) {
                $start = $first->copy()->addMonths($offset);
                $periods[] = $this->period($start, $start->copy()->addMonth(), $start->format('M'), 12, 'month');
            }

            return $periods;
        }

        if ($range === 'month') {
            $first = $now->copy()->startOfDay()->subDays(55);
            for ($offset = 0; $offset < 8; $offset++) {
                $start = $first->copy()->addDays($offset * 7);
                $periods[] = $this->period($start, $start->copy()->addDays(7), $start->format('j M'), 56, 'day');
            }

            return $periods;
        }

        $first = $now->copy()->startOfWeek();
        for ($offset = 0; $offset < 7; $offset++) {
            $start = $first->copy()->addDays($offset);
            $periods[] = $this->period($start, $start->copy()->addDay(), $start->format('D'), 7, 'day');
        }

        return $periods;
    }

    /** @return array{label: string, start: CarbonInterface, end: CarbonInterface, previous_start: CarbonInterface, previous_end: CarbonInterface} */
    private function period(CarbonInterface $start, CarbonInterface $end, string $label, int $previousAmount, string $previousUnit): array
    {
        return [
            'label' => $label,
            'start' => $start,
            'end' => $end,
            'previous_start' => $previousUnit === 'month' ? $start->copy()->subMonths($previousAmount) : $start->copy()->subDays($previousAmount),
            'previous_end' => $previousUnit === 'month' ? $end->copy()->subMonths($previousAmount) : $end->copy()->subDays($previousAmount),
        ];
    }

    private function bucketKey(CarbonInterface $date, string $unit): string
    {
        return $unit === 'month' ? $date->format('Y-m-01') : $date->format('Y-m-d');
    }

    private function bucketExpression(string $column, string $unit): string
    {
        if ($unit === 'month') {
            return match (DB::connection()->getDriverName()) {
                'sqlite' => "strftime('%Y-%m-01', {$column})",
                'pgsql' => "to_char(date_trunc('month', {$column}), 'YYYY-MM-DD')",
                default => "DATE_FORMAT({$column}, '%Y-%m-01')",
            };
        }

        return match (DB::connection()->getDriverName()) {
            'sqlite' => "date({$column})",
            'pgsql' => "to_char({$column}::date, 'YYYY-MM-DD')",
            default => "DATE({$column})",
        };
    }

    private function assertRange(string $range): void
    {
        if (! in_array($range, self::RANGES, true)) {
            throw new \InvalidArgumentException('Unsupported dashboard range.');
        }
    }

    private function mediaUrl($media): ?string
    {
        return $media === null ? null : MediaResource::make($media)->resolve(request())['url'];
    }

    private function cacheKey(string $segment): string
    {
        return "analytics:dashboard:v2:{$segment}";
    }

    private function remember(string $segment, Closure $callback): mixed
    {
        $cache = $this->cache();
        $key = $this->cacheKey($segment);
        $cached = $cache->get($key);

        if ($cached !== null) {
            return $cached;
        }

        return $cache->lock("{$key}:lock", 5)->block(2, fn () => $cache->remember(
            $key,
            now()->addSeconds(self::CACHE_TTL_SECONDS),
            $callback,
        ));
    }

    private function cache()
    {
        return Cache::store(config('crm.dashboard_cache_store'));
    }
}
