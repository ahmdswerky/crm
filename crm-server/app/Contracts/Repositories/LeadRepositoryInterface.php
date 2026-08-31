<?php

namespace App\Contracts\Repositories;

use App\Enums\LeadStatus;
use App\Models\Lead;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface LeadRepositoryInterface
{
    public function paginate(array $filters = []): LengthAwarePaginator;

    /** @return array{stats: array<string, int>, columns: array<string, array{data: Collection<int, Lead>, total: int, next_cursor: string|null, has_more: bool}>} */
    public function board(array $filters = []): array;

    public function cursorPaginate(array $filters = []): CursorPaginator;

    public function findById(int $id, array $with = []): ?Lead;

    public function store(array $data): Lead;

    public function update(Lead $lead, array $data): Lead;

    public function delete(int $id): bool;

    public function updateStatus(int $id, LeadStatus $status): bool;

    public function stats(): array;
}
