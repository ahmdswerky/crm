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
            'start' => max(today()->subDays(4)->diffInDays(today()), 1),
            'end' => null, // default is today
        ],
        'counts' => [
            Property::class => 1500,
            Lead::class => 2500,
            Deal::class => 1000,
        ],
    ],

];
