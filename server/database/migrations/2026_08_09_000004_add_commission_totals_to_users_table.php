<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('total_potential_commission', 14, 2)->default(0)->after('is_super');
            $table->decimal('total_actual_commission', 14, 2)->default(0)->after('total_potential_commission');
        });

        DB::table('commission_allocations')
            ->select('recipient_user_id', 'state')
            ->selectRaw('SUM(amount) AS total')
            ->whereNotNull('recipient_user_id')
            ->whereIn('state', ['estimate', 'final'])
            ->groupBy('recipient_user_id', 'state')
            ->get()
            ->each(function (object $allocation): void {
                $column = $allocation->state === 'final'
                    ? 'total_actual_commission'
                    : 'total_potential_commission';

                DB::table('users')
                    ->where('id', $allocation->recipient_user_id)
                    ->update([$column => round((float) $allocation->total, 2)]);
            });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'total_potential_commission',
                'total_actual_commission',
            ]);
        });
    }
};
