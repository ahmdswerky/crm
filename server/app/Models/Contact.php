<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['name', 'title', 'email', 'phone', 'account_id'])]
class Contact extends Model
{
    use HasFactory, SoftDeletes;

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }
}
