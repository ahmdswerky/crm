<?php

namespace App\Repositories;

use App\Contracts\Repositories\DealRepositoryInterface;
use App\Models\Deal;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Arr;
use Illuminate\Database\Eloquent\Builder;

class DealRepository implements DealRepositoryInterface
{
    public function __construct(protected readonly Deal $model) {}

    public function paginate(): LengthAwarePaginator
    {
        $isAgent = request()->user()->roles->contains('name', 'agent');
        $userId = request()->user()->id;

        return $this->model
            ->query()
            ->when($isAgent, fn (Builder $query) => $query->where('agent_id', $userId))
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

    /**
     * Select only the fields exposed by the nested deal resources.
     *
     * @return array<string, string>
     */
    private function dealRelations(): array
    {
        return [
            'contact:id,name,title,email,phone,created_at',
            'property:id,title,description,city,address,price,purpose,type,status,created_at',
            'agent:id,name,username,email,phone,created_at',
        ];
    }
}
