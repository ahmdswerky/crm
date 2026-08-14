<?php

namespace Database\Seeders;

use App\Enums\CommissionRecipientType;
use App\Models\CommissionPolicy;
use App\Models\User;
use Illuminate\Database\Seeder;

class CommissionPolicySeeder extends Seeder
{
    public function run(): void
    {
        CommissionPolicy::query()->firstOrCreate(
            [
                'recipient_type' => CommissionRecipientType::COMPANY->value,
                'user_id' => null,
                'effective_from' => today(),
            ],
            ['rate' => config('crm.commission_rates.company', 0)],
        );

        User::query()
            ->with('roles')
            ->get()
            ->each(function (User $user): void {
                $type = $user->roles->contains('name', 'manager')
                    ? CommissionRecipientType::MANAGER
                    : ($user->roles->contains('name', 'agent') ? CommissionRecipientType::AGENT : null);

                if (! $type) {
                    return;
                }

                CommissionPolicy::query()->firstOrCreate(
                    [
                        'recipient_type' => $type->value,
                        'user_id' => $user->id,
                        'effective_from' => today(),
                    ],
                    ['rate' => config('crm.commission_rates.'.$type->value, 0)],
                );
            });
    }
}
