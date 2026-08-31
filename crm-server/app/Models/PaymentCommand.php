<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentCommand extends Model
{
    protected $fillable = [
        'message_id',
        'correlation_id',
        'type',
        'version',
        'status',
        'payload',
        'result',
        'published_at',
        'completed_at',
        'failure_code',
        'failure_message',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'result' => 'array',
            'published_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }
}
