<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            $table->unsignedInteger('commission_version')->default(0)->after('commission_rate');
            $table->string('commission_status')->default('estimate')->after('commission_version');
            $table->decimal('commission_agent_amount', 12, 2)->default(0)->after('commission_status');
            $table->decimal('commission_manager_amount', 12, 2)->default(0)->after('commission_agent_amount');
            $table->decimal('commission_company_amount', 12, 2)->default(0)->after('commission_manager_amount');
            $table->decimal('commission_total_amount', 12, 2)->default(0)->after('commission_company_amount');
            $table->timestamp('commission_calculated_at')->nullable()->after('commission_total_amount');
            $table->timestamp('commission_finalized_at')->nullable()->after('commission_calculated_at');
            $table->index(['commission_status', 'commission_version']);
        });
    }

    public function down(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            $table->dropIndex('deals_commission_status_commission_version_index');
            $table->dropColumn([
                'commission_version',
                'commission_status',
                'commission_agent_amount',
                'commission_manager_amount',
                'commission_company_amount',
                'commission_total_amount',
                'commission_calculated_at',
                'commission_finalized_at',
            ]);
        });
    }
};
