<?php

namespace App\Models;

use App\Support\Audit\LogsCrmActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['name', 'title', 'email', 'phone', 'account_id', 'lead_id', 'assigned_agent_id'])]
class Contact extends Model
{
    use HasFactory, LogsCrmActivity, SoftDeletes;

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_agent_id')
            ->without('roles');
    }

    public function deals(): HasMany
    {
        return $this->hasMany(Deal::class);
    }

    public function leadAgent(): HasOneThrough
    {
        return $this->hasOneThrough(
            User::class,
            Lead::class,
            'id',
            'id',
            'lead_id',
            'assigned_agent_id',
        )->without('roles');
    }
}
