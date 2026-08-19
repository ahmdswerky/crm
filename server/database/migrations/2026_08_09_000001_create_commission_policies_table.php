<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commission_policies', function (Blueprint $table) {
            $table->id();
            $table->string('recipient_type');
            $table->foreignIdFor(User::class)->nullable()->constrained()->nullOnDelete();
            $table->decimal('rate', 8, 4);
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->timestamps();

            $table->index(['recipient_type', 'user_id', 'effective_from']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commission_policies');
    }
};
