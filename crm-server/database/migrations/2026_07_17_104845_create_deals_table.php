<?php

use App\Models\Contact;
use App\Models\Property;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deals', function (Blueprint $table) {
            $table->id();
            $table->decimal('value', 12, 2);
            $table->decimal('deal_value', 12, 2);
            $table->foreignIdFor(Contact::class)->index()->constrained();
            $table->foreignIdFor(Property::class)->index()->constrained();
            $table->foreignIdFor(User::class, 'agent_id')
                ->constrained('users')
                ->restrictOnDelete();
            $table->string('status');
            $table->timestamp('status_updated_at');
            $table->decimal('commission_rate', 12, 2);
            $table->timestamp('closed_at')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index('created_at');
            $table->index(['status_updated_at', 'status']);
            $table->index(['status', 'closed_at']);
            $table->index(['agent_id', 'status', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deals');
    }
};
