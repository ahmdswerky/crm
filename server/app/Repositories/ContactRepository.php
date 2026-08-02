<?php

namespace App\Repositories;

use App\Contracts\Repositories\ContactRepositoryInterface;
use App\Models\Contact;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;

class ContactRepository implements ContactRepositoryInterface
{
    public function __construct(protected Contact $model) {}

    public function paginate(array $filters = []): LengthAwarePaginator
    {
        return $this->model
            ->query()
            ->when($filters['q'] ?? null, function (Builder $query, string $search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('title', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhereHas('account', fn (Builder $query) => $query->where('name', 'like', "%{$search}%"));
                });
            })
            ->when($filters['title'] ?? null, fn (Builder $query, string $title) => $query->where('title', 'like', "%{$title}%"))
            ->when($filters['account'] ?? null, fn (Builder $query, int $accountId) => $query->where('account_id', $accountId))
            ->when($filters['created_from'] ?? null, fn (Builder $query, string $from) => $query->whereDate('created_at', '>=', $from))
            ->when($filters['created_to'] ?? null, fn (Builder $query, string $to) => $query->whereDate('created_at', '<=', $to))
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
            'lead_id' => $data['lead_id'],
            'assigned_agent_id' => $data['assigned_agent_id'],
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
