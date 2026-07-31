<?php

namespace App\Contracts\Repositories;

use App\Models\Lead;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface LeadRepositoryInterface
{
    public function paginate(array $filters = []): LengthAwarePaginator;

    public function findById(int $id, array $with = []): ?Lead;

    public function store(array $data): Lead;

    public function update(Lead $lead, array $data): Lead;

    public function delete(int $id): bool;
}
