<?php

namespace App\Repositories;

use App\Models\Deal;
use Illuminate\Pagination\LengthAwarePaginator;

interface DealRepositoryInterface
{
    public function paginate(): LengthAwarePaginator;

    public function find(int $id): Deal;

    public function store(array $data): Deal;

    public function update(Deal $deal, array $data): Deal;

    public function delete(int $id): bool;
}
