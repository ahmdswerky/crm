<?php

namespace App\Services\Activities;

use App\Events\Activities\ActivityChanged;
use App\Models\Activity;
use App\Models\User;
use App\Support\Activities\ActivityRecords;
use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ActivityService
{
    public const OUTCOMES = [
        'call' => ['reached', 'unanswered', 'busy', 'voicemail', 'wrong_number'],
        'meeting' => ['attended', 'no_show'],
        'viewing' => ['attended', 'no_show'],
    ];

    public function save(User $actor, array $input, ?Activity $existing = null): Activity
    {
        return DB::transaction(function () use ($actor, $input, $existing): Activity {
            $activity = $existing ? Activity::query()->lockForUpdate()->findOrFail($existing->id) : new Activity;
            Gate::forUser($actor)->authorize($existing ? 'update' : 'create', $existing ? $activity : Activity::class);
            if ($existing && $activity->version !== $input['version']) {
                abort(409, __('This activity changed. Reload it before saving.'));
            }
            $before = $existing ? $this->snapshot($activity) : [];
            $assignee = $input['assignee_id'] ?? ($existing ? $activity->assignee_id : ($actor->is_agent ? $actor->id : null));
            $assignee = $assignee ? (int) $assignee : null;
            if ($existing && $assignee !== $activity->assignee_id) {
                Gate::forUser($actor)->authorize('reassign', $activity);
            }
            if ((! $existing || $assignee !== $activity->assignee_id)
                && (! $assignee || ! User::agents()->whereKey($assignee)->exists())) {
                throw ValidationException::withMessages(['assignee_id' => __('Choose an active CRM agent.')]);
            }
            $activity->fill(Arr::except($input, ['links', 'version', 'assignee_id']));
            $activity->assignee_id = $assignee;
            $activity->creator_id = $existing ? $activity->creator_id : $actor->id;
            $activity->version = $existing ? $activity->version + 1 : 1;
            $this->validateState($activity, $before['status'] ?? null);
            foreach (['starts_at', 'ends_at', 'occurred_at'] as $field) {
                if ($activity->$field) {
                    $activity->$field = $activity->$field->utc();
                }
            }
            $activity->save();
            if (! $existing) {
                $records = app(ActivityRecords::class);
                foreach ($input['links'] as $subject) {
                    $record = $records->resolve($subject, false);
                    Gate::forUser($actor)->authorize('view', $record);
                    [$type, $id] = explode(':', $subject);
                    $activity->links()->create(['subject_type' => $type, 'subject_id' => $id, 'label' => $records->label($record)]);
                }
            }
            $action = ! $existing ? 'created' : ($activity->status !== $before['status'] ? $activity->status
                : ($activity->assignee_id !== $before['assignee_id'] ? 'reassigned' : 'corrected'));
            $event = $activity->events()->create([
                'event_id' => (string) Str::uuid(), 'actor_id' => $actor->id, 'actor_name' => $actor->name,
                'action' => $action, 'before' => $before, 'after' => $this->snapshot($activity->fresh()),
                'occurred_at' => $action === 'created' && $activity->status === 'completed' ? $activity->occurred_at : now(),
                'created_at' => now(),
            ]);
            ActivityChanged::dispatch($event->id);

            return $activity->fresh(['links', 'creator', 'assignee']);
        });
    }

    private function validateState(Activity $activity, ?string $previous): void
    {
        $errors = [];
        $allowed = match ($previous) {
            null => ['scheduled', 'completed'],
            'scheduled' => ['scheduled', 'completed', 'cancelled'],
            'completed' => ['completed', 'voided'],
            'cancelled' => ['cancelled', 'scheduled', 'voided'],
            default => [],
        };
        if (! in_array($activity->status, $allowed, true)) {
            $errors['status'] = __('This status transition is not allowed.');
        }
        if ($activity->kind === 'note' && ! in_array($activity->status, ['completed', 'voided'], true)) {
            $errors['status'] = __('Notes are logged as completed.');
        }
        if ($activity->status === 'scheduled') {
            if ($activity->kind === 'task') {
                if ((! $activity->due_date && ! $activity->starts_at) || ($activity->due_date && $activity->starts_at)) {
                    $errors['due_date'] = __('Choose either a due date or a start time for a task.');
                }
            } elseif (! $activity->starts_at) {
                $errors['starts_at'] = __('A scheduled interaction needs a start time.');
            }
            if ($activity->occurred_at || $activity->outcome || $activity->summary) {
                $errors['status'] = __('Complete this interaction to record its result.');
            }
        }
        if ($activity->due_date && $activity->kind !== 'task') {
            $errors['due_date'] = __('Only tasks have date-only deadlines.');
        }
        if ($activity->ends_at && (! $activity->starts_at || $activity->ends_at->lessThan($activity->starts_at))) {
            $errors['ends_at'] = __('End time must be on or after start time.');
        }
        if ($activity->status === 'completed') {
            $activity->occurred_at ??= CarbonImmutable::now();
            if ($activity->occurred_at->isFuture()) {
                $errors['occurred_at'] = __('Interactions cannot be logged in the future.');
            }
            if (isset(self::OUTCOMES[$activity->kind])) {
                if (! in_array($activity->outcome, self::OUTCOMES[$activity->kind], true)) {
                    $errors['outcome'] = __('Choose the interaction outcome.');
                }
                if (! trim($activity->summary ?? '')) {
                    $errors['summary'] = __('Add a short summary of the result.');
                }
            }
        }
        if ($activity->outcome && ! in_array($activity->outcome, self::OUTCOMES[$activity->kind] ?? [], true)) {
            $errors['outcome'] = __('This outcome is not valid for the interaction type.');
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }

    public function snapshot(Activity $activity): array
    {
        return array_merge($activity->only(['id', 'kind', 'subject', 'details', 'status', 'creator_id', 'assignee_id', 'outcome', 'summary', 'version']), [
            'assignee_name' => $activity->assignee->name,
            'due_date' => $activity->due_date?->format('Y-m-d'),
            'starts_at' => $activity->starts_at?->toISOString(), 'ends_at' => $activity->ends_at?->toISOString(),
            'occurred_at' => $activity->occurred_at?->toISOString(),
            'links' => $activity->links->map(fn ($link) => ['subject' => $link->subject_type.':'.$link->subject_id, 'label' => $link->label])->all(),
        ]);
    }
}
