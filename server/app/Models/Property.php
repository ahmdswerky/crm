<?php

namespace App\Models;

use App\Enums\PropertyPurpose;
use App\Enums\PropertyStatus;
use App\Enums\PropertyType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['owner_id', 'title', 'description', 'city', 'address', 'price', 'purpose', 'type', 'status'])]
class Property extends Model
{
    use HasFactory, SoftDeletes;

    protected function casts()
    {
        return [
            'price' => 'integer',
            'status' => PropertyStatus::class,
            'purpose' => PropertyPurpose::class,
            'type' => PropertyType::class,
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class)
            ->without('roles');
    }
}
