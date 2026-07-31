<?php

namespace App\Repositories;

use App\Contracts\Repositories\DealRepositoryInterface;
use App\Models\Deal;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;

class DealRepository implements DealRepositoryInterface
{
    public function __construct(protected readonly Deal $model) {}

    public function paginate(array $filters = []): LengthAwarePaginator
    {
        $isAgent = request()->user()->roles->contains('name', 'agent');
        $userId = request()->user()->id;

        return $this->model
            ->query()
            ->when($isAgent, fn (Builder $query) => $query->where('agent_id', $userId))
            ->when($filters['q'] ?? null, function (Builder $query, string $search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query
                        ->where('status', 'like', "%{$search}%")
                        ->orWhereHas('contact', fn (Builder $query) => $query->whereAny(['name', 'email', 'phone'], 'like', "%{$search}%"))
                        ->orWhereHas('property', fn (Builder $query) => $query->whereAny(['title', 'city', 'address'], 'like', "%{$search}%"))
                        ->orWhereHas('agent', fn (Builder $query) => $query->whereAny(['name', 'username', 'email', 'phone'], 'like', "%{$search}%"));
                });
            })
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($filters['contact'] ?? null, fn (Builder $query, int $contactId) => $query->where('contact_id', $contactId))
            ->when($filters['property'] ?? null, fn (Builder $query, int $propertyId) => $query->where('property_id', $propertyId))
            ->when($filters['agent'] ?? null, fn (Builder $query, int $agentId) => $query->where('agent_id', $agentId))
            ->when($filters['closed_from'] ?? null, fn (Builder $query, string $from) => $query->whereDate('closed_at', '>=', $from))
            ->when($filters['closed_to'] ?? null, fn (Builder $query, string $to) => $query->whereDate('closed_at', '<=', $to))
            ->when($filters['min_value'] ?? null, fn (Builder $query, float $value) => $query->where('value', '>=', $value))
            ->when($filters['max_value'] ?? null, fn (Builder $query, float $value) => $query->where('value', '<=', $value))
            ->when($filters['min_deal_value'] ?? null, fn (Builder $query, float $value) => $query->where('deal_value', '>=', $value))
            ->when($filters['max_deal_value'] ?? null, fn (Builder $query, float $value) => $query->where('deal_value', '<=', $value))
            ->with($this->dealRelations())
            ->paginate();
    }

    public function find(int $id): Deal
    {
        return $this->model
            ->query()
            ->with($this->dealRelations())
            ->findOrFail($id);
    }

    public function store(array $data): Deal
    {
        return $this->model->create([
            'value' => $data['value'],
            'deal_value' => $data['deal_value'],
            'contact_id' => $data['contact_id'],
            'property_id' => $data['property_id'],
            'agent_id' => $data['agent_id'],
            'status' => $data['status'],
            'commission_rate' => $data['commission_rate'],
            'closed_at' => $data['closed_at'] ?? null,
        ])->load($this->dealRelations());
    }

    public function update(Deal $deal, array $data): Deal
    {
        $deal->update([
            'value' => Arr::get($data, 'value', $deal->value),
            'deal_value' => Arr::get($data, 'deal_value', $deal->deal_value),
            'contact_id' => Arr::get($data, 'contact_id', $deal->contact_id),
            'property_id' => Arr::get($data, 'property_id', $deal->property_id),
            'agent_id' => Arr::get($data, 'agent_id', $deal->agent_id),
            'status' => Arr::get($data, 'status', $deal->status),
            'commission_rate' => Arr::get($data, 'commission_rate', $deal->commission_rate),
            'closed_at' => Arr::get($data, 'closed_at', $deal->closed_at),
        ]);

        $deal->refresh();

        return $deal->load($this->dealRelations());
    }

    public function delete(int $id): bool
    {
        return (bool) $this->model->destroy($id);
    }

    private function dealRelations(): array
    {
        return [
            'contact:id,name,title,email,phone,created_at',
            'property:id,title,description,city,address,price,purpose,type,status,created_at',
            'agent:id,name,username,email,phone,created_at',
        ];
    }

    public function filtersInfo(): array
    {
        $valuesRange = $this->model
            ->selectRaw('MIN(value) as min_value, MAX(value) as max_value, MIN(deal_value) as min_deal_value, MAX(deal_value) as max_deal_value')
            ->first()
            ->toArray();

        return [
            ...$valuesRange,
        ];
    }
}
