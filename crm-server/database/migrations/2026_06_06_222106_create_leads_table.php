<?php

use App\Enums\LeadStatus;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('phone', 30)->unique();
            $table->string('status', 20)->default(LeadStatus::PENDING->value);
            $table->string('city');
            $table->string('address', 200)->nullable();
            $table->string('company_name', 150)->nullable();
            $table->string('source', 50)->nullable();
            $table->foreignIdFor(User::class, 'assigned_agent_id')
                ->index()
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->softDeletes();
            $table->timestamps();

            $table->index('created_at');
            $table->index(['status', 'created_at', 'id']);
            $table->index(['assigned_agent_id', 'status', 'created_at', 'id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('leads');
    }
};
