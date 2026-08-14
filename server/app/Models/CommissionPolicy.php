<?php

namespace App\Models;

use App\Enums\CommissionRecipientType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['recipient_type', 'user_id', 'rate', 'effective_from', 'effective_to'])]
#[Hidden(['created_at', 'updated_at'])]
class CommissionPolicy extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'recipient_type' => CommissionRecipientType::class,
            'user_id' => 'integer',
            'rate' => 'float',
            'effective_from' => 'date',
            'effective_to' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function rateValue(): Attribute
    {
        return Attribute::make(
            get: fn () => (float) $this->rate,
        );
    }
}
