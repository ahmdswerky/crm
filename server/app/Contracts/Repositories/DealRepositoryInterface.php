<?php

namespace App\Contracts\Repositories;

use App\Enums\DealStatus;
use App\Models\Deal;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface DealRepositoryInterface
{
    public function paginate(array $filters = []): LengthAwarePaginator;

    public function find(int $id): Deal;

    public function store(array $data): Deal;

    public function update(Deal $deal, array $data): Deal;

    public function delete(int $id): bool;

    public function filtersInfo(): array;

    public function updateStatus(int $id, DealStatus $status): bool;

    public function statusesForProperty(int $propertyId): Collection;
}
