<?php

namespace App\Http\Controllers;

use App\Http\Requests\AnalyticsReportIndexRequest;
use App\Http\Requests\OverviewChartRequest;
use App\Http\Resources\ReportRunResource;
use App\Models\ReportRun;
use App\Services\AnalyticsService;
use App\Services\OverviewAnalyticsService;
use Illuminate\Routing\Attributes\Controllers\Authorize;
use Illuminate\Support\Facades\Storage;

class AnalyticsController extends Controller
{
    public function __construct(
        protected AnalyticsService $analytics,
        protected OverviewAnalyticsService $overviewAnalytics,
    ) {}

    #[Authorize('viewAny', ReportRun::class)]
    public function overview()
    {
        return response()->json([
            'overview' => $this->analytics->overview(),
        ]);
    }

    #[Authorize('viewAny', ReportRun::class)]
    public function metrics()
    {
        return $this->overviewResponse(['metrics' => $this->overviewAnalytics->metrics()]);
    }

    #[Authorize('viewAny', ReportRun::class)]
    public function leaderboard(OverviewChartRequest $request)
    {
        return $this->overviewResponse(['leaderboard' => $this->overviewAnalytics->leaderboard($request->validated('range') ?? 'month')]);
    }

    #[Authorize('viewAny', ReportRun::class)]
    public function revenue(OverviewChartRequest $request)
    {
        return $this->overviewResponse(['revenue' => $this->overviewAnalytics->revenue($request->validated('range') ?? 'month')]);
    }

    #[Authorize('viewAny', ReportRun::class)]
    public function customers()
    {
        return $this->overviewResponse(['customers' => $this->overviewAnalytics->customers()]);
    }

    #[Authorize('viewAny', ReportRun::class)]
    public function deals()
    {
        return $this->overviewResponse(['deals' => $this->overviewAnalytics->deals()]);
    }

    #[Authorize('viewAny', ReportRun::class)]
    public function accounts()
    {
        return $this->overviewResponse(['accounts' => $this->overviewAnalytics->accounts()]);
    }

    #[Authorize('viewAny', ReportRun::class)]
    public function properties()
    {
        return $this->overviewResponse(['properties' => $this->overviewAnalytics->properties()]);
    }

    #[Authorize('viewAny', ReportRun::class)]
    public function reports(AnalyticsReportIndexRequest $request)
    {
        $filters = $request->validated();
        $reports = ReportRun::query()
            ->when($filters['cadence'] ?? null, fn ($query, string $cadence) => $query->where('cadence', $cadence))
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->when($filters['period_from'] ?? null, fn ($query, string $from) => $query->where('period_start', '>=', $from))
            ->when($filters['period_to'] ?? null, fn ($query, string $to) => $query->where('period_end', '<=', $to))
            ->latest('period_start')
            ->paginate($filters['per_page'] ?? 20)
            ->withQueryString();

        return ReportRunResource::collection($reports);
    }

    #[Authorize('view', 'reportRun')]
    public function showReport(ReportRun $reportRun)
    {
        return response()->json([
            'report' => ReportRunResource::make($reportRun),
        ]);
    }

    #[Authorize('download', 'reportRun')]
    public function downloadReport(ReportRun $reportRun)
    {
        return Storage::disk('local')->download(
            $reportRun->csv_path,
            sprintf('%s-%s-%s.csv', $reportRun->definition, $reportRun->cadence, $reportRun->period_start->utc()->format('Y-m-d')),
            ['Content-Type' => 'text/csv; charset=UTF-8'],
        );
    }

    /** @param array<string, mixed> $payload */
    private function overviewResponse(array $payload)
    {
        return response()->json($payload)
            ->header('Cache-Control', 'private, max-age=15, stale-while-revalidate=30')
            ->header('Vary', 'Authorization');
    }
}
