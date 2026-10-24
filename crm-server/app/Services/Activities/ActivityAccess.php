<?php

namespace App\Services\Activities;

use App\Models\Activities\ActivityLink;
use App\Models\Activity;
use App\Models\User;
use App\Support\Activities\ActivityRecords;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Gate;

class ActivityAccess
{
    public function visible(User $user, Activity $activity): bool
    {
        if ($activity->links->isEmpty()) {
            return false;
        }
        foreach ($activity->links as $link) {
            $model = ActivityRecords::MODELS[$link->subject_type] ?? null;
            $record = $model ? $model::withTrashed()->find($link->subject_id) : null;
            if (! $record || Gate::forUser($user)->denies('view', $record)) {
                return false;
            }
        }

        return true;
    }

    public function constrain(Builder $query, User $user): Builder
    {
        // shortcut: loads candidate targets; use policy-aware SQL scopes if record volume makes this slow.
        $targets = ActivityLink::query()->whereIn('activity_id', (clone $query)->select('activities.id'))
            ->select('subject_type', 'subject_id')->distinct()->get();
        $denied = [];
        foreach ($targets->groupBy('subject_type') as $type => $links) {
            $model = ActivityRecords::MODELS[$type] ?? null;
            $records = $model ? $model::withTrashed()->whereKey($links->pluck('subject_id'))->get()->keyBy('id') : collect();
            foreach ($links as $link) {
                $record = $records->get($link->subject_id);
                if (! $record || Gate::forUser($user)->denies('view', $record)) {
                    $denied[$type][] = $link->subject_id;
                }
            }
        }
        if ($denied !== []) {
            $query->whereDoesntHave('links', function (Builder $links) use ($denied): void {
                $links->where(function (Builder $links) use ($denied): void {
                    foreach ($denied as $type => $ids) {
                        $links->orWhere(fn (Builder $link) => $link->where('subject_type', $type)->whereIn('subject_id', $ids));
                    }
                });
            });
        }

        return $query->has('links');
    }

    public function forSubjects(Builder $query, array $subjects): Builder
    {
        return $query->whereHas('links', function (Builder $links) use ($subjects): void {
            $links->where(function (Builder $links) use ($subjects): void {
                foreach ($subjects as $subject) {
                    [$type, $id] = explode(':', $subject);
                    $links->orWhere(fn (Builder $link) => $link->where('subject_type', $type)->where('subject_id', $id));
                }
            });
        });
    }
}
