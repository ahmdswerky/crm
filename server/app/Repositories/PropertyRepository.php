<?php

namespace App\Repositories;

use App\Contracts\Repositories\PropertyRepositoryInterface;
use App\Enums\PropertyPurpose;
use App\Enums\PropertyStatus;
use App\Models\Property;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;

class PropertyRepository implements PropertyRepositoryInterface
{
    public function __construct(protected readonly Property $model) {}

    public function paginate(array $filters = []): LengthAwarePaginator
    {
        return $this->model
            ->query()
            ->when($filters['q'] ?? null, function (Builder $query, string $search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query
                        ->where('title', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhere('city', 'like', "%{$search}%")
                        ->orWhere('address', 'like', "%{$search}%")
                        ->orWhereHas('createdBy', fn (Builder $query) => $query->where('name', 'like', "%{$search}%"));
                });
            })
            ->when($filters['type'] ?? null, fn (Builder $query, string $type) => $query->where('type', $type))
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($filters['city'] ?? null, fn (Builder $query, string $city) => $query->where('city', 'like', "%{$city}%"))
            ->when($filters['min_price'] ?? null, fn (Builder $query, float $price) => $query->where('price', '>=', $price))
            ->when($filters['max_price'] ?? null, fn (Builder $query, float $price) => $query->where('price', '<=', $price))
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
        $model = $this->model->create([
            'created_by' => $data['created_by'],
            'title' => $data['title'],
            'description' => $data['description'],
            'city' => $data['city'],
            'address' => $data['address'],
            'price' => $data['price'],
            // 'purpose' => $data['purpose'] ?? PropertyPurpose::SALE,
            'type' => $data['type'],
            'status' => $data['status'] ?? PropertyStatus::PENDING,
        ])->load(['createdBy', 'media']);

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

        return $property->fresh(['createdBy', 'media']);
    }

    public function delete(int $id): bool
    {
        return (bool) $this->model->destroy($id);
    }

    public function filtersInfo(): array
    {
        $priceRange = $this->model
            ->selectRaw('MIN(price) as min_price, MAX(price) as max_price')
            ->first()
            ->toArray();

        return [
            ...$priceRange,
        ];
    }
}
