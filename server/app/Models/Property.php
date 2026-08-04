<?php

namespace App\Models;

use App\Enums\PropertyPurpose;
use App\Enums\PropertyStatus;
use App\Enums\PropertyType;
use App\Support\Audit\LogsCrmActivity;
use App\Support\Media\HasGallery;
use App\Support\Media\HasMedia;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\MediaLibrary\HasMedia as SpatieHasMedia;

#[Fillable(['created_by', 'title', 'description', 'city', 'address', 'price', 'purpose', 'type', 'status'])]
class Property extends Model implements SpatieHasMedia
{
    use HasFactory, HasGallery, HasMedia, LogsCrmActivity, SoftDeletes;

    protected function casts()
    {
        return [
            'price' => 'integer',
            'status' => PropertyStatus::class,
            'purpose' => PropertyPurpose::class,
            'type' => PropertyType::class,
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')
            ->without('roles');
    }

    public function deals(): HasMany
    {
        return $this->hasMany(Deal::class);
    }
}
