<?php

namespace App\Models\Activities;

use App\Support\Activities\ImmutableActivityBuilder;
use Illuminate\Database\Eloquent\Model;
use LogicException;

class ActivityLink extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Saved activity links are fixed.'));
        static::deleting(fn () => throw new LogicException('Saved activity links are fixed.'));
    }

    public function delete()
    {
        throw new LogicException('Activity history and links cannot be deleted.');
    }

    public function newEloquentBuilder($query)
    {
        return new ImmutableActivityBuilder($query);
    }
}
