<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Deal;
use App\Models\User;
use App\Support\Audit\ActivitySubjectRegistry;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class ActivityReversionService
{
    public function __construct(
        protected readonly ActivitySubjectRegistry $subjects,
        protected readonly DealService $dealService,
    ) {}

    public function revert(int $activityId, User $actor, string $reason): ActivityLog
    {
        return DB::transaction(function () use ($activityId, $actor, $reason): ActivityLog {
            $activity = ActivityLog::query()->lockForUpdate()->findOrFail($activityId);

            if ($activity->log_name !== 'crm' || ! in_array($activity->event, ['updated', 'deleted'], true)) {
                throw new UnprocessableEntityHttpException('Only CRM updates and soft deletions can be reverted.');
            }

            $subject = $this->lockedSubject($activity);
            $latestActivity = ActivityLog::query()
                ->inLog('crm')
                ->forSubject($subject)
                ->latest('id')
                ->lockForUpdate()
                ->first();

            if ($latestActivity?->id !== $activity->id) {
                throw new ConflictHttpException('Only the latest change for a record can be reverted.');
            }

            $restoredAttributes = $this->revertSubject($activity, $subject);

            $reversion = activity('crm')
                ->performedOn($subject)
                ->causedBy($actor)
                ->event('reverted')
                ->withProperties([
                    'reverted_activity_id' => $activity->id,
                    'reason' => $reason,
                    'restored_attributes' => $restoredAttributes,
                ])
                ->log('reverted a record change');

            return $reversion;
        });
    }

    private function lockedSubject(ActivityLog $activity): Model
    {
        if ($activity->subject_type === null || $activity->subject_id === null) {
            throw new UnprocessableEntityHttpException('This activity has no reversible subject.');
        }

        $model = $this->subjects->modelForMorphType($activity->subject_type);

        $query = method_exists($model, 'getDeletedAtColumn')
            ? $model::withTrashed()
            : $model::query();

        return $query->lockForUpdate()->findOrFail($activity->subject_id);
    }

    /** @return array<int, string> */
    private function revertSubject(ActivityLog $activity, Model $subject): array
    {
        if ($activity->event === 'deleted') {
            if (! method_exists($subject, 'restore')) {
                throw new UnprocessableEntityHttpException('This activity subject cannot be restored.');
            }

            $subject->restore();

            return ['deleted_at'];
        }

        $oldValues = $activity->attribute_changes?->get('old', []) ?? [];

        if ($oldValues === []) {
            throw new UnprocessableEntityHttpException('This activity has no reversible attributes.');
        }

        $subject->fill($oldValues);
        $subject->save();

        if ($subject instanceof Deal) {
            $this->dealService->recalculateCommission($subject);
        }

        return array_keys($oldValues);
    }
}
