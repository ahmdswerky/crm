<?php

namespace App\Repositories;

use App\Contracts\Repositories\LeadRepositoryInterface;
use App\Enums\LeadStatus;
use App\Models\Lead;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;

class LeadRepository implements LeadRepositoryInterface
{
    public function __construct(protected readonly Lead $model) {}

    public function paginate(array $filters = []): LengthAwarePaginator
    {
        return $this->filteredQuery($filters)
            ->withExists('contact')
            ->with(['assignedAgent.media'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(perPage: $filters['per_page'] ?? 15);
    }

    public function board(array $filters = []): array
    {
        $perPage = (int) ($filters['per_page'] ?? 5);
        $totals = $this->filteredQuery($filters, includeStatus: false)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $ranked = $this->filteredQuery($filters, includeStatus: false)
            ->select('leads.*')
            ->withExists('contact')
            ->selectRaw('ROW_NUMBER() OVER (PARTITION BY status ORDER BY created_at DESC, id DESC) as status_row_number');

        $leads = $this->model->newQueryWithoutScopes()
            ->fromSub($ranked->toBase(), 'pipeline_leads')
            ->select('pipeline_leads.*')
            ->where('status_row_number', '<=', $perPage)
            ->orderBy('status')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->with(['assignedAgent.media'])
            ->get();

        $leadsByStatus = $leads->groupBy(fn (Lead $lead): string => $lead->status->value);
        $columns = [];

        foreach (LeadStatus::cases() as $status) {
            /** @var Collection<int, Lead> $items */
            $items = $leadsByStatus->get($status->value, collect())->values();
            $total = (int) ($totals->get($status->value) ?? 0);
            $hasMore = $total > $items->count();
            $last = $items->last();

            $columns[$status->value] = [
                'data' => $items,
                'total' => $total,
                'next_cursor' => $hasMore && $last
                    ? (new Cursor([
                        'created_at' => $last->getRawOriginal('created_at'),
                        'id' => $last->id,
                    ]))->encode()
                    : null,
                'has_more' => $hasMore,
            ];
        }

        return [
            'stats' => $this->stats()['stats'],
            'columns' => $columns,
        ];
    }

    public function cursorPaginate(array $filters = []): CursorPaginator
    {
        return $this->filteredQuery($filters)
            ->withExists('contact')
            ->with(['assignedAgent.media'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->cursorPaginate(
                perPage: $filters['per_page'] ?? 5,
                cursorName: 'cursor',
                cursor: $filters['cursor'] ?? null,
            );
    }

    public function findById(int $id, array $with = []): ?Lead
    {
        return $this->model
            ->with(array_merge([
                'assignedAgent:id,name,username,email',
                'assignedAgent.media',
            ], $with))
            ->findOrFail($id);
    }

    public function store(array $data): Lead
    {
        return $this->model->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'],
            'status' => $data['status'] ?? LeadStatus::PENDING,
            'city' => $data['city'],
            'address' => $data['address'] ?? null,
            'company_name' => $data['company_name'] ?? null,
            'source' => $data['source'] ?? null,
        ])->load(['assignedAgent']);
    }

    public function update(Lead $lead, array $data): Lead
    {
        $lead->update([
            'name' => Arr::get($data, 'name', $lead->name),
            'email' => Arr::get($data, 'email', $lead->email),
            'phone' => Arr::get($data, 'phone', $lead->phone),
            'status' => Arr::get($data, 'status', $lead->status),
            'city' => Arr::get($data, 'city', $lead->city),
            'address' => Arr::get($data, 'address', $lead->address),
            'company_name' => Arr::get($data, 'company_name', $lead->company_name),
            'source' => Arr::get($data, 'source', $lead->source),
            'assigned_agent_id' => Arr::get($data, 'assigned_agent_id', $lead->assigned_agent_id),
        ]);

        return $lead->fresh(['assignedAgent.media']);
    }

    public function delete(int $id): bool
    {
        return (bool) $this->model->destroy($id);
    }

    public function updateStatus(int $id, LeadStatus $status): bool
    {
        $lead = $this->model->findOrFail($id);

        return $lead->update([
            'status' => $status,
        ]);
    }

    public function stats(): array
    {
        $isAgent = request()->user()->roles->contains('name', 'agent');
        $userId = request()->user()->id;

        $stats = $this->model->selectRaw('COUNT(id) FILTER(WHERE status = ?) as pending_count, COUNT(id) FILTER(WHERE status = ?) as contacted_count, COUNT(id) FILTER(WHERE status = ?) as qualified_count, COUNT(id) FILTER(WHERE status = ?) as unqalified_count', [
            LeadStatus::PENDING->value,
            LeadStatus::CONTACTED->value,
            LeadStatus::QUALIFIED->value,
            LeadStatus::UNQUALIFIED->value,
        ])
        ->when($isAgent, fn (Builder $query) => $query->where('assigned_agent_id', $userId))
        ->first();

        return [
            'stats' => [
                'pending_count' => $stats->pending_count,
                'contacted_count' => $stats->contacted_count,
                'qualified_count' => $stats->qualified_count,
                'unqalified_count' => $stats->unqalified_count,
            ],
        ];
    }

    private function filteredQuery(array $filters, bool $includeStatus = true): Builder
    {
        $isAgent = request()->user()->roles->contains('name', 'agent');
        $userId = request()->user()->id;

        return $this->model
            ->query()
            ->when($isAgent, fn (Builder $query) => $query->where('assigned_agent_id', $userId))
            ->when($filters['q'] ?? null, function (Builder $query, string $search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query
                        ->whereLike('name', "%{$search}%")
                        ->orWhereLike('email', "%{$search}%")
                        ->orWhereLike('phone', "%{$search}%")
                        ->orWhereLike('city', "%{$search}%")
                        ->orWhereLike('address', "%{$search}%")
                        ->orWhereLike('company_name', "%{$search}%");
                });
            })
            ->when($filters['assigned_agent'] ?? null, fn (Builder $query, string $assignedAgent) => $query->where('assigned_agent_id', $assignedAgent))
            ->when($includeStatus ? ($filters['status'] ?? null) : null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($filters['source'] ?? null, fn (Builder $query, string $source) => $query->where('source', $source))
            ->when($filters['city'] ?? null, fn (Builder $query, string $city) => $query->whereLike('city', "%{$city}%"))
            ->when($filters['company'] ?? null, fn (Builder $query, string $company) => $query->whereLike('company_name', "%{$company}%"))
            ->when($filters['created_from'] ?? null, fn (Builder $query, string $from) => $query->whereDate('created_at', '>=', $from))
            ->when($filters['created_to'] ?? null, fn (Builder $query, string $to) => $query->whereDate('created_at', '<=', $to));
    }
}
