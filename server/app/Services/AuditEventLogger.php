<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class AuditEventLogger
{
    public function rolesUpdated(User $user, array $beforeRoles, array $afterRoles): void
    {
        activity('crm')
            ->performedOn($user)
            ->event('roles_updated')
            ->withProperties([
                'before' => ['roles' => array_values($beforeRoles)],
                'after' => ['roles' => array_values($afterRoles)],
            ])
            ->log('updated user roles');
    }

    public function passwordUpdated(User $user): void
    {
        activity('crm')
            ->performedOn($user)
            ->event('password_updated')
            ->log('updated user password');
    }

    public function mediaUploaded(Model $model, Media $media, User $causer): void
    {
        activity('crm')
            ->causedBy($causer)
            ->performedOn($model)
            ->event('media_uploaded')
            ->withProperties(['media_id' => $media->id, 'collection' => $media->collection_name])
            ->log('uploaded media');
    }

    public function mediaDeleted(Model $model, Media $media, User $causer): void
    {
        activity('crm')
            ->causedBy($causer)
            ->performedOn($model)
            ->event('media_deleted')
            ->withProperties(['media_id' => $media->id, 'collection' => $media->collection_name])
            ->log('deleted media');
    }

    /** @param array<int, int> $mediaIds */
    public function mediaReordered(Model $model, array $mediaIds, string $collection, User $causer): void
    {
        activity('crm')
            ->causedBy($causer)
            ->performedOn($model)
            ->event('media_reordered')
            ->withProperties(['media_ids' => $mediaIds, 'collection' => $collection])
            ->log('reordered media');
    }
}
