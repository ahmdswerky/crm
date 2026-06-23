<?php

namespace App\Contracts\Repositories;

use App\Models\Contact;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface ContactRepositoryInterface
{
    public function paginate(): LengthAwarePaginator;

    public function find(int $id): ?Contact;

    public function store(array $data): Contact;

    public function update(Contact $contact, array $data): ?Contact;

    public function delete(int $id): bool;
}
