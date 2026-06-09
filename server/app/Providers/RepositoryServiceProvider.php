<?php

namespace App\Providers;

use App\Contracts\Repositories\LeadRepositoryInterface;
use App\Contracts\Repositories\PropertyRepositoryInterface;
use App\Contracts\Repositories\UserRepositoryInterface;
use App\Repositories\LeadRepository;
use App\Repositories\PropertyRepository;
use App\Repositories\UserRepository;
use Illuminate\Support\ServiceProvider;

class RepositoryServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        $this->app->bind(UserRepositoryInterface::class, UserRepository::class);
        $this->app->bind(LeadRepositoryInterface::class, LeadRepository::class);
        $this->app->bind(PropertyRepositoryInterface::class, PropertyRepository::class);
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void {}
}
