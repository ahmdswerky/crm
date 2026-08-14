<?php

namespace App\Models;

use App\Enums\DealStatus;
use App\Support\Audit\LogsCrmActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['value', 'deal_value', 'contact_id', 'property_id', 'agent_id', 'status', 'commission_rate', 'closed_at'])]
class Deal extends Model
{
    use HasFactory, LogsCrmActivity, SoftDeletes;

    protected function casts(): array
    {
        return [
            'value' => 'float',
            'deal_value' => 'float',
            'status' => DealStatus::class,
            'commission_rate' => 'float',
            'closed_at' => 'date',
        ];
    }

    public function scopeByAgent(Builder $query, int $userId): Builder
    {
        return $query->where('agent_id', $userId);
    }

    public function scopeInquiry(Builder $query): Builder
    {
        return $query->where('status', DealStatus::INQUIRY);
    }

    public function scopeViweing(Builder $query): Builder
    {
        return $query->where('status', DealStatus::VIEWING);
    }

    public function scopeLegal(Builder $query): Builder
    {
        return $query->where('status', DealStatus::LEGAL);
    }

    public function scopeOfferMade(Builder $query): Builder
    {
        return $query->where('status', DealStatus::OFFER_MADE);
    }

    public function scopeWon(Builder $query): Builder
    {
        return $query->where('status', DealStatus::WON);
    }

    public function scopeLost(Builder $query): Builder
    {
        return $query->where('status', DealStatus::LOST);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_id')
            ->without('roles');
    }
}
