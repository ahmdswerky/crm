<?php

namespace App\Contracts\Repositories;

use App\Enums\PropertyStatus;
use App\Models\Property;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface PropertyRepositoryInterface
{
    public function paginate(array $filters = []): LengthAwarePaginator;

    public function findById(int $id, array $with = []): ?Property;

    public function store(array $data): Property;

    public function update(Property $property, array $data): Property;

    public function delete(int $id): bool;

    public function filtersInfo(): array;

    public function updateStatus(int $id, PropertyStatus $status): bool;

    public function lockByIds(array $ids): Collection;
}
