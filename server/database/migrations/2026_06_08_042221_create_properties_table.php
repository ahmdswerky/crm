<?php

use App\Enums\PropertyPurpose;
use App\Enums\PropertyStatus;
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
        Schema::create('properties', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(User::class, 'owner_id')->index();
            $table->string('title')->unique();
            $table->text('description');
            $table->string('city')->index();
            $table->string('address', 200)->nullable();
            $table->decimal('price', 12, 2)->index();
            $table->string('purpose', 20)->default(PropertyPurpose::SALE->value);
            $table->string('type', 100);
            $table->string('status')->default(PropertyStatus::PENDING->value);
            $table->softDeletes();
            $table->timestamps();

            $table->index(['type', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('properties');
    }
};
