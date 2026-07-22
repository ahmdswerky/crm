<?php

namespace App\Models;

use App\Enums\DealStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['value', 'deal_value', 'contact_id', 'property_id', 'status', 'commission_rate', 'closed_at'])]
class Deal extends Model
{
    use HasFactory;

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

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }
}
