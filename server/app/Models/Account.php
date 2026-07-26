<?php

namespace App\Models;

use App\Support\Audit\LogsCrmActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['name', 'industry', 'phone', 'address'])]
class Account extends Model
{
    use HasFactory, LogsCrmActivity, SoftDeletes;

    public function contacts(): HasMany
    {
        return $this->hasMany(Contact::class);
    }
}
