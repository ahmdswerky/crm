<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_event_inbox', function (Blueprint $table): void {
            $table->uuid('event_id')->primary();
            $table->uuid('correlation_id')->index();
            $table->string('type', 120);
            $table->unsignedSmallInteger('version');
            $table->string('source', 120);
            $table->json('payload');
            $table->timestamp('received_at');
            $table->timestamp('applied_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_event_inbox');
    }
};
