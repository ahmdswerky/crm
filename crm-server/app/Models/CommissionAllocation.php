<?php

namespace App\Models;

use App\Enums\CommissionAllocationState;
use App\Enums\CommissionRecipientType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'deal_id',
    'version',
    'recipient_type',
    'recipient_user_id',
    'commission_policy_id',
    'base_amount',
    'rate',
    'amount',
    'state',
    'snapshotted_at',
])]
class CommissionAllocation extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'recipient_type' => CommissionRecipientType::class,
            'recipient_user_id' => 'integer',
            'commission_policy_id' => 'integer',
            'base_amount' => 'float',
            'rate' => 'float',
            'amount' => 'float',
            'state' => CommissionAllocationState::class,
            'snapshotted_at' => 'datetime',
        ];
    }

    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class);
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_user_id')
            ->without('roles');
    }

    public function policy(): BelongsTo
    {
        return $this->belongsTo(CommissionPolicy::class, 'commission_policy_id');
    }

    public function isCompany(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->recipient_type === CommissionRecipientType::COMPANY,
        );
    }
}
