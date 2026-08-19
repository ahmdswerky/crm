<?php

namespace App\Http\Controllers;

use App\Contracts\Repositories\ActivityLogRepositoryInterface;
use App\Http\Requests\ActivityLog\ActivityLogIndexRequest;
use App\Http\Requests\ActivityLog\ActivityLogRevertRequest;
use App\Http\Resources\ActivityLogResource;
use App\Models\ActivityLog;
use App\Services\ActivityReversionService;
use Illuminate\Routing\Attributes\Controllers\Authorize;

class ActivityLogController extends Controller
{
    public function __construct(
        protected ActivityLogRepositoryInterface $activityLogRepository,
        protected ActivityReversionService $activityReversionService,
    ) {}

    #[Authorize('viewAny', ActivityLog::class)]
    public function index(ActivityLogIndexRequest $request)
    {
        $data = $this->activityLogRepository->paginate($request->validated());

        return ActivityLogResource::collection($data);
    }

    #[Authorize('view', 'activityLog')]
    public function show(ActivityLog $activityLog)
    {
        $activityLog->load(['causer', 'subject']);

        return response()->json([
            'activity_log' => ActivityLogResource::make($activityLog),
        ]);
    }

    #[Authorize('revert', 'activityLog')]
    public function revert(ActivityLogRevertRequest $request, ActivityLog $activityLog)
    {
        $reversion = $this->activityReversionService->revert(
            $activityLog->id,
            $request->user(),
            $request->string('reason')->toString(),
        );

        $reversion->load(['causer', 'subject']);

        return response()->json([
            'activity_log' => ActivityLogResource::make($reversion),
        ]);
    }
}
