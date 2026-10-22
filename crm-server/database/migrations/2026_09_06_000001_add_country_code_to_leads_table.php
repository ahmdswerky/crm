<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->string('country_code', 2)->nullable()->after('city');
            $table->index(['status', 'country_code', 'deleted_at']);
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->dropIndex('leads_status_country_code_deleted_at_index');
            $table->dropColumn('country_code');
        });
    }
};
