<?php

namespace App\Contracts\Repositories;

use App\Models\Property;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface PropertyRepositoryInterface
{
    public function paginate(array $filters = []): LengthAwarePaginator;

    public function findById(int $id, array $with = []): ?Property;

    public function store(array $data): Property;

    public function update(Property $property, array $data): Property;

    public function delete(int $id): bool;

    public function filtersInfo(): array;
}
