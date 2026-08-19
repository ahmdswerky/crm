<?php

use App\Models\CommissionPolicy;
use App\Models\Deal;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commission_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(Deal::class)->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('recipient_type');
            $table->foreignId('recipient_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignIdFor(CommissionPolicy::class)->nullable()->nullOnDelete();
            $table->decimal('base_amount', 12, 2);
            $table->decimal('rate', 8, 4);
            $table->decimal('amount', 12, 2);
            $table->string('state');
            $table->timestamp('snapshotted_at')->nullable();
            $table->timestamps();

            $table->unique(['deal_id', 'version', 'recipient_type']);
            $table->index(['recipient_user_id', 'state']);
            $table->index(['deal_id', 'state']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commission_allocations');
    }
};
