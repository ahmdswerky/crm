<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReportRunResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->uuid,
            'definition' => $this->resource->definition,
            'cadence' => $this->resource->cadence,
            'status' => $this->resource->status,
            'period_start' => $this->resource->period_start,
            'period_end' => $this->resource->period_end,
            'generated_at' => $this->resource->completed_at,
            'duration_ms' => $this->resource->duration_ms,
            'download_available' => $this->resource->status === 'completed' && $this->resource->csv_path !== null,
            'snapshot' => $this->when($request->route('reportRun') !== null, $this->resource->snapshot),
            'failure' => $this->when($request->user()?->is_super === true && $this->resource->status === 'failed', [
                'code' => $this->resource->failure_code,
                'message' => $this->resource->failure_message,
            ]),
        ];
    }
}
