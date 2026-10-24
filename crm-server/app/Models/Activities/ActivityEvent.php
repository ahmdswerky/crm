<?php

namespace App\Models\Activities;

use App\Models\Activity;
use App\Support\Activities\ImmutableActivityBuilder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class ActivityEvent extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['before' => 'array', 'after' => 'array', 'occurred_at' => 'immutable_datetime', 'created_at' => 'immutable_datetime'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Activity event details are immutable.'));
        static::deleting(fn () => throw new LogicException('Activity history cannot be deleted.'));
    }

    public function delete()
    {
        throw new LogicException('Activity history and links cannot be deleted.');
    }

    public function newEloquentBuilder($query)
    {
        return new ImmutableActivityBuilder($query);
    }

    public function activity(): BelongsTo
    {
        return $this->belongsTo(Activity::class);
    }
}
