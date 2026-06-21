<?php

namespace App\Repositories;

use App\Contracts\Repositories\AccountRepositoryInterface;
use App\Models\Account;
use Arr;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class AccountRepository implements AccountRepositoryInterface
{
    public function __construct(protected readonly Account $model) {}

    public function paginate(): LengthAwarePaginator
    {
        return $this->model
            ->query()
            ->paginate();
    }

    public function find(int $id): ?Account
    {
        return $this->model
            ->query()
            ->findOrFail($id);
    }

    public function store(array $data): Account
    {
        return $this->model
            ->query()
            ->create([
                'name' => $data['name'],
                'industry' => $data['industry'],
                'phone' => $data['phone'],
                'address' => $data['address'],
            ]);
    }

    public function update(Account $account, array $data): Account
    {
        $account->update([
            'name' => Arr::get($data, 'name', $account->name),
            'industry' => Arr::get($data, 'industry', $account->industry),
            'phone' => Arr::get($data, 'phone', $account->phone),
            'address' => Arr::get($data, 'address', $account->address),
        ]);

        return $account->fresh();
    }

    public function delete(int $id): bool
    {
        return (bool) $this->model->destroy($id);
    }
}
