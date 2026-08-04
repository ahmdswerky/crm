<?php

namespace App\Contracts\Repositories;

use App\Models\Account;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface AccountRepositoryInterface
{
    public function paginate(array $filters = []): LengthAwarePaginator;

    public function findById(int $id): ?Account;

    public function findOrCreateByName(string $name, ?string $phone): Account;

    public function store(array $data): Account;

    public function update(Account $account, array $data): Account;

    public function delete(int $id): bool;
}
