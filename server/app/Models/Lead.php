<?php

namespace App\Models;

use App\Enums\LeadSource;
use App\Enums\LeadStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['name', 'email', 'phone', 'status', 'city', 'address', 'company_name', 'source'])]
class Lead extends Model
{
    use HasFactory, SoftDeletes;

    protected function casts()
    {
        return [
            'status' => LeadStatus::class,
            'source' => LeadSource::class,
        ];
    }
}
