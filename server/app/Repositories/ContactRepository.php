<?php

namespace App\Repositories;

use App\Contracts\Repositories\ContactRepositoryInterface;
use App\Models\Contact;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Arr;

class ContactRepository implements ContactRepositoryInterface
{
    public function __construct(protected Contact $model) {}

    public function paginate(): LengthAwarePaginator
    {
        return $this->model
            ->query()
            ->with([
                'account' => function ($query) {
                    $query->select([
                        'id',
                        'name',
                    ]);
                },
            ])
            ->paginate();
    }

    public function find(int $id): ?Contact
    {
        return $this->model
            ->query()
            ->with([
                'account',
            ])
            ->findOrFail($id);
    }

    public function store(array $data): Contact
    {
        return $this->model->create([
            'name' => $data['name'],
            'title' => $data['title'] ?? null,
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'],
            'account_id' => $data['account_id'],
        ])->load(['account']);
    }

    public function update(Contact $contact, array $data): ?Contact
    {
        $contact->update([
            'name' => Arr::get($data, 'name', $contact->name),
            'title' => Arr::get($data, 'title', $contact->title),
            'email' => Arr::get($data, 'email', $contact->email),
            'phone' => Arr::get($data, 'phone', $contact->phone),
            'account_id' => Arr::get($data, 'account_id', $contact->account_id),
        ]);

        return $contact->fresh(['account']);
    }

    public function delete(int $id): bool
    {
        return (bool) $this->model->destroy($id);
    }
}
