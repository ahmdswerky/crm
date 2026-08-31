<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'uuid', 'definition', 'cadence', 'status', 'period_start', 'period_end', 'attempts',
    'started_at', 'completed_at', 'duration_ms', 'snapshot', 'csv_path', 'csv_checksum',
    'csv_size', 'failure_code', 'failure_message', 'expires_at',
])]
class ReportRun extends Model
{
    protected function casts(): array
    {
        return [
            'period_start' => 'datetime',
            'period_end' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'snapshot' => 'array',
            'expires_at' => 'datetime',
            'attempts' => 'integer',
            'duration_ms' => 'integer',
            'csv_size' => 'integer',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }
}
