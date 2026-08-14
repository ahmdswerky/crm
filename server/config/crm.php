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
        'counts' => [
            Property::class => 15000,
            Lead::class => 25000,
            Deal::class => 10000,
        ],
    ],

];
