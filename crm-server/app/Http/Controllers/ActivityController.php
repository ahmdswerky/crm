<?php

namespace App\Http\Controllers;

use App\Http\Requests\Activities\SaveActivityRequest;
use App\Http\Resources\MediaResource;
use App\Models\Activities\ActivityEvent;
use App\Models\Activity;
use App\Models\Deal;
use App\Models\User;
use App\Services\Activities\ActivityAccess;
use App\Services\Activities\ActivityService;
use App\Support\Activities\ActivityRecords;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class ActivityController extends Controller
{
    public function __construct(private ActivityService $service, private ActivityAccess $access, private ActivityRecords $records) {}

    private function query(Request $request)
    {
        Gate::authorize('viewAny', Activity::class);
        $filters = $request->validate([
            'subject' => ['nullable', 'string', 'regex:/^(lead|contact|deal|property):[1-9][0-9]*$/D'],
            'kind' => ['nullable', Rule::in(['call', 'email', 'message', 'meeting', 'viewing', 'note', 'task'])],
            'status' => ['nullable', Rule::in(['scheduled', 'completed', 'cancelled', 'voided'])],
            'assignee_id' => ['nullable', 'integer', 'min:1'],
            'bucket' => ['nullable', Rule::in(['overdue', 'today', 'upcoming'])],
            'page' => ['nullable', 'integer', 'min:1'], 'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $query = Activity::query();
        foreach (['kind', 'status', 'assignee_id'] as $field) {
            if (isset($filters[$field])) {
                $query->where($field, $filters[$field]);
            }
        }
        if (! empty($filters['subject'])) {
            $this->access->forSubjects($query, $this->records->subjects($filters['subject'], $request->user()));
        }
        if (! empty($filters['bucket'])) {
            $now = now(config('activities.timezone'));
            $query->where('status', 'scheduled');
            if ($filters['bucket'] === 'overdue') {
                $query->where(fn ($q) => $q->whereDate('due_date', '<', $now->toDateString())->orWhere('starts_at', '<', $now->utc()));
            } elseif ($filters['bucket'] === 'today') {
                $query->where(fn ($q) => $q->whereDate('due_date', $now->toDateString())
                    ->orWhereBetween('starts_at', [$now->copy()->startOfDay()->utc(), $now->copy()->endOfDay()->utc()]));
            } else {
                $query->where(fn ($q) => $q->whereDate('due_date', '>', $now->toDateString())->orWhere('starts_at', '>', $now->copy()->endOfDay()->utc()));
            }
        }

        return $this->access->constrain($query, $request->user());
    }

    public function index(Request $request)
    {
        $query = $this->query($request)->with(['links', 'creator.media', 'assignee.media']);
        $page = $query->orderByRaw('CASE WHEN status = ? THEN 0 ELSE 1 END', ['scheduled'])
            ->orderByRaw('COALESCE(due_date, starts_at, occurred_at, created_at)')->orderBy('id')
            ->paginate($request->integer('per_page', 20));
        $page->through(fn (Activity $activity) => $this->resource($activity));

        return response()->json($page);
    }

    public function show(Activity $activity)
    {
        Gate::authorize('view', $activity);

        return response()->json(['data' => $this->resource($activity)]);
    }

    public function store(SaveActivityRequest $request)
    {
        return response()->json(['data' => $this->resource($this->service->save($request->user(), $request->validated()))], 201);
    }

    public function update(SaveActivityRequest $request, Activity $activity)
    {
        return response()->json(['data' => $this->resource($this->service->save($request->user(), $request->validated(), $activity))]);
    }

    public function history(Request $request)
    {
        $visible = $this->query($request)->select('activities.id');
        $page = ActivityEvent::query()->whereIn('activity_id', $visible)->orderByDesc('occurred_at')->orderByDesc('id')
            ->paginate($request->integer('per_page', 20));
        $page->through(fn (ActivityEvent $event) => $event->only(['id', 'activity_id', 'event_id', 'actor_id', 'actor_name', 'action', 'before', 'after', 'occurred_at', 'created_at']));

        return response()->json($page);
    }

    public function options(Request $request)
    {
        Gate::authorize('viewAny', Activity::class);
        $input = $request->validate(['subject' => ['nullable', 'string'], 'type' => ['nullable', Rule::in(array_keys(ActivityRecords::MODELS))], 'search' => ['nullable', 'string', 'max:100']]);
        $suggestions = [];
        if (! empty($input['subject'])) {
            $record = $this->records->resolve($input['subject']);
            Gate::authorize('view', $record);
            $suggestions[] = ['subject' => $input['subject'], 'label' => $this->records->label($record)];
            if ($record instanceof Deal) {
                foreach (['contact', 'property'] as $type) {
                    $related = $record->$type;
                    if ($related && Gate::allows('view', $related)) {
                        $suggestions[] = ['subject' => $type.':'.$related->id, 'label' => $this->records->label($related)];
                    }
                }
            }
        }
        $records = [];
        if (! empty($input['type'])) {
            $type = $input['type'];
            $model = ActivityRecords::MODELS[$type];
            if (Gate::allows('viewAny', $model)) {
                $query = $model::query();
                $name = in_array($type, ['property', 'deal'], true) ? ($type === 'property' ? 'title' : 'id') : 'name';
                if (! empty($input['search'])) {
                    if ($type === 'deal') {
                        $query->whereKey(ctype_digit($input['search']) ? $input['search'] : 0);
                    } else {
                        $query->where($name, 'like', '%'.$input['search'].'%');
                    }
                }
                $records = $query->orderByDesc('id')->limit(30)->get()->filter(fn ($record) => Gate::allows('view', $record))
                    ->map(fn ($record) => ['subject' => $type.':'.$record->id, 'label' => $this->records->label($record)])->values()->all();
            }
        }

        return response()->json(['agents' => User::agents()->with('media')->orderBy('name')->get(['id', 'name'])->map(fn (User $agent) => $this->person($agent)),
            'suggestions' => $suggestions, 'records' => $records, 'timezone' => config('activities.timezone')]);
    }

    private function resource(Activity $activity): array
    {
        $activity->loadMissing(['links', 'creator.media', 'assignee.media']);

        return array_merge($this->service->snapshot($activity), [
            'creator' => $this->person($activity->creator), 'assignee' => $this->person($activity->assignee),
            'created_at' => $activity->created_at->toISOString(), 'updated_at' => $activity->updated_at->toISOString(),
            'can_edit' => Gate::allows('update', $activity), 'can_reassign' => Gate::allows('reassign', $activity),
        ]);
    }

    private function person(User $user): array
    {
        return [...$user->only(['id', 'name']),
            'avatar' => ($avatar = $user->getFirstMedia('main')) ? MediaResource::make($avatar) : null];
    }
}
