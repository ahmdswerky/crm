<?php

namespace App\Models;

use App\Models\Activities\ActivityEvent;
use App\Models\Activities\ActivityLink;
use App\Support\Activities\RetainedActivityBuilder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use LogicException;

class Activity extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['starts_at' => 'immutable_datetime', 'ends_at' => 'immutable_datetime',
            'occurred_at' => 'immutable_datetime', 'due_date' => 'immutable_date', 'version' => 'integer'];
    }

    public function newEloquentBuilder($query)
    {
        return new RetainedActivityBuilder($query);
    }

    public function delete()
    {
        throw new LogicException('Activities must be cancelled or voided, not deleted.');
    }

    public function links(): HasMany
    {
        return $this->hasMany(ActivityLink::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(ActivityEvent::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id')->withTrashed();
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id')->withTrashed();
    }
}
