<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentEventInbox extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $table = 'payment_event_inbox';

    protected $primaryKey = 'event_id';

    protected $keyType = 'string';

    protected $fillable = [
        'event_id',
        'correlation_id',
        'type',
        'version',
        'source',
        'payload',
        'received_at',
        'applied_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'received_at' => 'datetime',
            'applied_at' => 'datetime',
        ];
    }
}
