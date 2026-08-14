<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Property;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Validation\ValidationException;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class MediaOwnerRegistry
{
    /** @return array<int, string> */
    public function types(): array
    {
        return ['account', 'property', 'user'];
    }

    public function resolve(string $type, int $id): Model&HasMedia
    {
        $model = match ($type) {
            'account' => Account::query()->find($id),
            'property' => Property::query()->find($id),
            'user' => User::query()->find($id),
            default => null,
        };

        if ($model === null) {
            throw (new ModelNotFoundException)->setModel($type, [$id]);
        }

        return $model;
    }

    public function resolveMediaOwner(Media $media): Model&HasMedia
    {
        $type = match ($media->model_type) {
            Account::class => 'account',
            Property::class => 'property',
            User::class => 'user',
            default => null,
        };

        if ($type === null) {
            throw (new ModelNotFoundException)->setModel(Media::class, [$media->getKey()]);
        }

        return $this->resolve($type, (int) $media->model_id);
    }

    public function assertSupportsCollection(Model&HasMedia $model, string $collection): void
    {
        if ($model->getMediaCollection($collection) === null) {
            throw ValidationException::withMessages([
                'collection' => ['The requested media collection is not supported by this record.'],
            ]);
        }
    }
}
