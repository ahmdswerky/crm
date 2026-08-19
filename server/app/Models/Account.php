<?php

namespace App\Models;

use App\Support\Audit\LogsCrmActivity;
use App\Support\Media\HasMain;
use App\Support\Media\HasMedia;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\MediaLibrary\HasMedia as SpatieHasMedia;

#[Fillable(['name', 'industry', 'phone', 'address'])]
class Account extends Model implements SpatieHasMedia
{
    use HasFactory, HasMain, HasMedia, LogsCrmActivity, SoftDeletes;

    public function contacts(): HasMany
    {
        return $this->hasMany(Contact::class);
    }
}
