<?php

namespace App\Services;

use App\Jobs\GenerateAnalyticsReportJob;
use App\Models\ReportRun;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class ReportArchiveService
{
    public function queue(string $definition, string $cadence, CarbonInterface $start, CarbonInterface $end): ReportRun
    {
        $run = $this->createRun($definition, $cadence, $start, $end);

        if ($run->wasRecentlyCreated) {
            GenerateAnalyticsReportJob::dispatch($run->id)->afterCommit();
        }

        return $run;
    }

    public function createRun(string $definition, string $cadence, CarbonInterface $start, CarbonInterface $end): ReportRun
    {
        return ReportRun::query()->firstOrCreate([
            'definition' => $definition,
            'cadence' => $cadence,
            'period_start' => $start,
        ], [
            'uuid' => (string) Str::uuid(),
            'status' => 'queued',
            'period_end' => $end,
            'expires_at' => $cadence === 'daily' ? $end->copy()->addMonthsNoOverflow(18) : null,
        ]);
    }

    public function generate(ReportRun $run, AnalyticsService $analytics): void
    {
        $startedAt = now('UTC');
        $run->forceFill([
            'status' => 'running',
            'started_at' => $startedAt,
            'completed_at' => null,
            'duration_ms' => null,
            'attempts' => $run->attempts + 1,
            'failure_code' => null,
            'failure_message' => null,
        ])->save();

        $snapshot = $analytics->salesPipelineReport($run->period_start->utc(), $run->period_end->utc());
        $csv = $this->csv($snapshot, $run);
        $path = sprintf('reports/%s/%s/%s.csv', $run->cadence, $run->period_start->utc()->format('Y-m-d'), $run->uuid);

        if (! Storage::disk('local')->put($path, $csv)) {
            throw new RuntimeException('The report CSV could not be saved.');
        }

        $completedAt = now('UTC');
        $run->forceFill([
            'status' => 'completed',
            'completed_at' => $completedAt,
            'duration_ms' => $startedAt->diffInMilliseconds($completedAt),
            'snapshot' => $snapshot,
            'csv_path' => $path,
            'csv_checksum' => hash('sha256', $csv),
            'csv_size' => strlen($csv),
        ])->save();
    }

    public function markFailed(ReportRun $run, Throwable $exception): void
    {
        $completedAt = now('UTC');
        $run->forceFill([
            'status' => 'failed',
            'completed_at' => $completedAt,
            'duration_ms' => $run->started_at?->diffInMilliseconds($completedAt),
            'failure_code' => class_basename($exception),
            'failure_message' => Str::limit($exception->getMessage(), 1000),
        ])->save();
    }

    /** @param array<string, mixed> $snapshot */
    private function csv(array $snapshot, ReportRun $run): string
    {
        $stream = fopen('php://temp', 'r+');
        fputcsv($stream, ['section', 'metric', 'dimensions', 'value', 'unit', 'period_start', 'period_end', 'generated_at']);
        $this->flatten($stream, $snapshot, '', [], $run);
        rewind($stream);
        $csv = stream_get_contents($stream) ?: '';
        fclose($stream);

        return $csv;
    }

    /** @param resource $stream @param array<string, string|int|float|bool|null> $dimensions */
    private function flatten($stream, mixed $value, string $path, array $dimensions, ReportRun $run): void
    {
        if (is_array($value)) {
            foreach ($value as $key => $item) {
                $nextPath = $path === '' ? (string) $key : $path.'.'.$key;
                $nextDimensions = $dimensions;
                if (is_string($key) && is_scalar($item) && in_array($key, ['status', 'purpose', 'type', 'agent_id', 'agent_name'], true)) {
                    $nextDimensions[$key] = $item;
                }
                $this->flatten($stream, $item, $nextPath, $nextDimensions, $run);
            }

            return;
        }

        if (! is_scalar($value) && $value !== null) {
            return;
        }

        $parts = explode('.', $path);
        fputcsv($stream, [
            $parts[0] ?? 'report',
            $path,
            json_encode($dimensions, JSON_THROW_ON_ERROR),
            $value,
            is_numeric($value) ? 'value' : 'text',
            $run->period_start->utc()->toIso8601String(),
            $run->period_end->utc()->toIso8601String(),
            now('UTC')->toIso8601String(),
        ]);
    }
}
