<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_runs', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('definition', 80);
            $table->string('cadence', 20);
            $table->string('status', 20)->default('queued');
            $table->timestamp('period_start');
            $table->timestamp('period_end');
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->float('duration_ms')->nullable();
            $table->json('snapshot')->nullable();
            $table->string('csv_path')->nullable();
            $table->string('csv_checksum', 64)->nullable();
            $table->unsignedInteger('csv_size')->nullable();
            $table->string('failure_code')->nullable();
            $table->text('failure_message')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->unique(['definition', 'cadence', 'period_start'], 'report_runs_period_unique');
            $table->index(['status', 'expires_at']);
            $table->index(['cadence', 'period_start']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_runs');
    }
};
