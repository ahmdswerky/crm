<?php

namespace App\Models;

use App\Enums\CommissionRecipientType;
use App\Support\Audit\LogsCrmActivity;
use App\Support\Media\HasMain;
use App\Support\Media\HasMedia;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\HasApiTokens;
use Spatie\MediaLibrary\HasMedia as SpatieHasMedia;
use Spatie\Permission\Traits\HasRoles;

#[Fillable([
    'name',
    'email',
    'username',
    'phone',
    'password',
    'is_super',
    'direct_manager_id',
    'total_potential_commission',
    'total_actual_commission',
])]
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
            'total_potential_commission' => 'float',
            'total_actual_commission' => 'float',
        ];
    }

    public function scopeManagers(Builder $query): Builder
    {
        return $query->whereHas('roles', fn (Builder $roles) => $roles->where('name', 'manager'));
    }

    public function scopeAgents(Builder $query): Builder
    {
        return $query->whereHas('roles', fn (Builder $roles) => $roles->where('name', 'agent'));
    }

    public function isAgent(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->roles->contains('name', 'agent'),
        );
    }

    public function commissionRate(): Attribute
    {
        return Attribute::make(
            get: function () {
                $recipientType = $this->roles->contains('name', 'manager')
                    ? CommissionRecipientType::MANAGER
                    : ($this->roles->contains('name', 'agent') ? CommissionRecipientType::AGENT : null);

                if (! $recipientType) {
                    return 1;
                }

                $policy = CommissionPolicy::query()
                    ->where('recipient_type', $recipientType->value)
                    ->where('user_id', $this->id)
                    ->whereDate('effective_from', '<=', today())
                    ->where(function ($query): void {
                        $query
                            ->whereNull('effective_to')
                            ->orWhereDate('effective_to', '>=', today());
                    })
                    ->latest('effective_from')
                    ->first();

                return $policy?->rate ?? config('crm.commission_rates.'.$recipientType->value, 1);
            }
        );
    }

    public function totalPotentialCommission(): Attribute
    {
        return Attribute::make(
            get: fn () => (float) ($this->attributes['total_potential_commission'] ?? 0),
        );
    }

    public function totalActualCommission(): Attribute
    {
        return Attribute::make(
            get: fn () => (float) ($this->attributes['total_actual_commission'] ?? 0),
        );
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(self::class, 'direct_manager_id')
            ->without('roles');
    }

    public function teamMemebers(): HasMany
    {
        return $this->hasMany(self::class, 'direct_manager_id')
            ->without('roles');
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
