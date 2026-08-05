<?php

namespace Database\Seeders;

use App\Models\Deal;
use App\Services\DealService;
use Illuminate\Database\Seeder;

class DealSeeder extends Seeder
{
    public function run(): void
    {
        $deals = Deal::factory()
            ->count(100)
            ->create();

        $deals->pluck('property_id')->map(function ($propertyId) {
            app(DealService::class)->synchronizePropertyStatus($propertyId);
        });
    }
}
