<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_commands', function (Blueprint $table): void {
            $table->id();
            $table->uuid('message_id')->unique();
            $table->uuid('correlation_id')->index();
            $table->string('type', 120);
            $table->unsignedSmallInteger('version')->default(1);
            $table->string('status', 20)->default('pending');
            $table->json('payload');
            $table->json('result')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->string('failure_code')->nullable();
            $table->text('failure_message')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_commands');
    }
};
