<?php

namespace App\Models;

use App\Enums\LeadSource;
use App\Enums\LeadStatus;
use App\Support\Audit\LogsCrmActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
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

    public function assignedAgent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_agent_id')
            ->without('roles');
    }
}
