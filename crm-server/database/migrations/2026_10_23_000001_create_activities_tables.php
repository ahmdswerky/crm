<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activities', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 24);
            $table->string('subject', 200);
            $table->text('details')->nullable();
            $table->string('status', 24);
            $table->foreignId('creator_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('assignee_id')->constrained('users')->restrictOnDelete();
            $table->date('due_date')->nullable();
            $table->timestampTz('starts_at')->nullable();
            $table->timestampTz('ends_at')->nullable();
            $table->timestampTz('occurred_at')->nullable();
            $table->string('outcome', 32)->nullable();
            $table->text('summary')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestampsTz();
            $table->index(['assignee_id', 'status', 'starts_at']);
            $table->index(['status', 'due_date']);
        });

        Schema::create('activity_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('activity_id')->constrained()->restrictOnDelete();
            $table->string('subject_type', 16);
            $table->unsignedBigInteger('subject_id');
            $table->string('label');
            $table->unique(['activity_id', 'subject_type', 'subject_id']);
            $table->index(['subject_type', 'subject_id', 'activity_id']);
        });

        Schema::create('activity_events', function (Blueprint $table) {
            $table->id();
            $table->uuid('event_id')->unique();
            $table->foreignId('activity_id')->constrained()->restrictOnDelete();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->string('actor_name');
            $table->string('action', 24);
            $table->json('before');
            $table->json('after');
            $table->timestampTz('occurred_at');
            $table->timestampTz('created_at');
            $table->index(['activity_id', 'occurred_at', 'id']);
        });
        Schema::create('activity_history_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('activity_event_id')->unique()->constrained()->restrictOnDelete();
            $table->timestampTz('recorded_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_history_entries');
        Schema::dropIfExists('activity_events');
        Schema::dropIfExists('activity_links');
        Schema::dropIfExists('activities');
    }
};
