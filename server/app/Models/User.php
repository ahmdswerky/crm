<?php

namespace App\Models;

use App\Support\Audit\LogsCrmActivity;
use App\Support\Media\HasMain;
use App\Support\Media\HasMedia;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\HasApiTokens;
use Spatie\MediaLibrary\HasMedia as SpatieHasMedia;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['name', 'email', 'username', 'phone', 'password', 'is_super'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements SpatieHasMedia
{
    use HasApiTokens, HasFactory, HasMain, HasMedia, HasRoles, LogsCrmActivity, Notifiable, SoftDeletes;

    protected $with = [
        'roles.permissions',
    ];

    protected function auditAttributes(): array
    {
        return ['name', 'email', 'username', 'phone', 'is_super'];
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_super' => 'boolean',
        ];
    }

    public function scopeAgents(Builder $query): Builder
    {
        return $query->whereHas('roles', fn (Builder $roles) => $roles->where('name', 'agent'));
    }

    public function properties(): HasMany
    {
        return $this->hasMany(Property::class, 'created_by');
    }

    public function assignedLeads(): HasMany
    {
        return $this->hasMany(Lead::class, 'assigned_agent_id');
    }

    public function deals(): HasMany
    {
        return $this->hasMany(Deal::class, 'agent_id');
    }

    public function checkPassword(string $password)
    {
        $hashedPassword = $this->attributes['password'];

        return Hash::check($password, $hashedPassword);
    }
}
