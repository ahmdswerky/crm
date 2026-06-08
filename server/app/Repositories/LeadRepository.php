<?php

namespace App\Repositories;

use App\Contracts\Repositories\LeadRepositoryInterface;
use App\Enums\LeadStatus;
use App\Models\Lead;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Arr;

class LeadRepository implements LeadRepositoryInterface
{
    public function __construct(protected readonly Lead $model) {}

    public function paginate(): LengthAwarePaginator
    {
        return $this->model
            ->query()
            ->paginate();
    }

    public function findById(int $id, array $with = []): ?Lead
    {
        return $this->model
            ->with($with)
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
        ]);
    }

    public function update(Lead $user, array $data): Lead
    {
        $user->update([
            'name' => Arr::get($data, 'name', $user->name),
            'email' => Arr::get($data, 'email', $user->email),
            'phone' => Arr::get($data, 'phone', $user->phone),
            'status' => Arr::get($data, 'status', $user->status),
            'city' => Arr::get($data, 'city', $user->city),
            'address' => Arr::get($data, 'address', $user->address),
            'company_name' => Arr::get($data, 'company_name', $user->company_name),
            'source' => Arr::get($data, 'source', $user->source),
        ]);

        return $user->fresh();
    }

    public function delete(int $id): bool
    {
        return (bool) $this->model->destroy($id);
    }
}
