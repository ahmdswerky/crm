<?php

namespace App\Repositories;

use App\Contracts\Repositories\PropertyRepositoryInterface;
use App\Enums\PropertyPurpose;
use App\Enums\PropertyStatus;
use App\Models\Property;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Arr;

class PropertyRepository implements PropertyRepositoryInterface
{
    public function __construct(protected readonly Property $model) {}

    public function paginate(): LengthAwarePaginator
    {
        return $this->model
            ->query()
            ->with([
                'owner',
            ])
            ->paginate();
    }

    public function findById(int $id, array $with = []): ?Property
    {
        return $this->model
            ->with($with)
            ->findOrFail($id);
    }

    public function store(array $data): Property
    {
        $model = $this->model->with(['owner'])->create([
            'owner_id' => $data['owner_id'],
            'title' => $data['title'],
            'description' => $data['description'],
            'city' => $data['city'],
            'address' => $data['address'],
            'price' => $data['price'],
            // 'purpose' => $data['purpose'] ?? PropertyPurpose::SALE,
            'type' => $data['type'],
            'status' => $data['status'] ?? PropertyStatus::PENDING,
        ]);

        return $model;
    }

    public function update(Property $property, array $data): Property
    {
        $property->update([
            'title' => Arr::get($data, 'title', $property->title),
            'description' => Arr::get($data, 'description', $property->description),
            'city' => Arr::get($data, 'city', $property->city),
            'address' => Arr::get($data, 'address', $property->address),
            'price' => Arr::get($data, 'price', $property->price),
            // 'purpose' => Arr::get($data, 'purpose', $property->purpose),
            'type' => Arr::get($data, 'type', $property->type),
            'status' => Arr::get($data, 'status', $property->status),
        ]);

        return $property->fresh(['owner']);
    }

    public function delete(int $id): bool
    {
        return (bool) $this->model->destroy($id);
    }
}
