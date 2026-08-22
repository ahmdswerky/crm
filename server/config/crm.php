<?php

use App\Models\Deal;
use App\Models\Lead;
use App\Models\Property;

return [

    'commission_rates' => [
        'manager' => 1,
        'agent' => 1.5,
        'company' => 2.5,
    ],

    'dashboard_cache_store' => env('DASHBOARD_CACHE_STORE', env('CACHE_STORE', 'database')),

    'seeds' => [
        'enabled' => env('SEEDS_ENABLED', true),
        'shared_property_images' => env('SEEDS_SHARED_PROPERTY_IMAGES', true),
        'period' => [ // in days
            'start' => max(today()->subDays(35)->diffInDays(today()), 1),
            'end' => null, // default is today
        ],
        'counts' => [
            Property::class => 15000,
            Lead::class => 25000,
            Deal::class => 10000,
            'property_media' => 15000,
        ],
        'max_counts' => [
            Property::class => (int) env('PROPERTIES_SEED_MAX_TOTAL', 100000),
            Lead::class => (int) env('LEADS_SEED_MAX_TOTAL', 100000),
            Deal::class => (int) env('DEALS_SEED_MAX_TOTAL', 100000),
            'property_media' => (int) env('PROPERTY_MEDIA_SEED_MAX_TOTAL', 100000),
        ],
    ],

];
