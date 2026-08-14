<?php

namespace App\Models;

use App\Enums\LeadSource;
use App\Enums\LeadStatus;
use App\Support\Audit\LogsCrmActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['name', 'email', 'phone', 'status', 'city', 'address', 'company_name', 'source', 'assigned_agent_id'])]
class Lead extends Model
{
    use HasFactory, LogsCrmActivity, SoftDeletes;

    protected function casts()
    {
        return [
            'status' => LeadStatus::class,
            'source' => LeadSource::class,
        ];
    }

    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', LeadStatus::PENDING);
    }

    public function scopeContacted(Builder $query): Builder
    {
        return $query->where('status', LeadStatus::CONTACTED);
    }

    public function scopeQualified(Builder $query): Builder
    {
        return $query->where('status', LeadStatus::QUALIFIED);
    }

    public function scopeAssigned(Builder $query): Builder
    {
        return $query->whereNotNull('assigned_agent_id');
    }

    public function assignedAgent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_agent_id')
            ->without('roles');
    }

    public function contact(): HasOne
    {
        return $this->hasOne(Contact::class);
    }
}
