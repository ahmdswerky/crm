<?php

namespace App\Repositories;

use App\Contracts\Repositories\LeadRepositoryInterface;
use App\Enums\LeadStatus;
use App\Models\Lead;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;

class LeadRepository implements LeadRepositoryInterface
{
    public function __construct(protected readonly Lead $model) {}

    public function paginate(array $filters = []): LengthAwarePaginator
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
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($filters['source'] ?? null, fn (Builder $query, string $source) => $query->where('source', $source))
            ->when($filters['city'] ?? null, fn (Builder $query, string $city) => $query->whereLike('city', "%{$city}%"))
            ->when($filters['company'] ?? null, fn (Builder $query, string $company) => $query->whereLike('company_name', "%{$company}%"))
            ->when($filters['created_from'] ?? null, fn (Builder $query, string $from) => $query->whereDate('created_at', '>=', $from))
            ->when($filters['created_to'] ?? null, fn (Builder $query, string $to) => $query->whereDate('created_at', '<=', $to))
            ->with(['assignedAgent:id,name,username,email'])
            ->withExists('contact')
            ->latest('updated_at')
            ->paginate(perPage: $filters['per_page'] ?? 15);
    }

    public function findById(int $id, array $with = []): ?Lead
    {
        return $this->model
            ->with(array_merge([
                'assignedAgent:id,name,username,email',
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

        return $lead->fresh(['assignedAgent']);
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
}
