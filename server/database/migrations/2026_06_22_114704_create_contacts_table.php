<?php

use App\Models\Account;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(Account::class)->index()->constrained();
            $table->foreignIdFor(Lead::class)->unique()->constrained();
            $table->string('name')->index();
            $table->string('title')->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 30)->unique();
            $table->foreignIdFor(User::class, 'assigned_agent_id')->index()->constrained();
            $table->softDeletes();
            $table->timestamps();

            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contacts');
    }
};
