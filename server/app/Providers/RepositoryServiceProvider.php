<?php

namespace App\Providers;

use App\Contracts\Repositories\AccountRepositoryInterface;
use App\Contracts\Repositories\ActivityLogRepositoryInterface;
use App\Contracts\Repositories\ContactRepositoryInterface;
use App\Contracts\Repositories\DealRepositoryInterface;
use App\Contracts\Repositories\LeadRepositoryInterface;
use App\Contracts\Repositories\PropertyRepositoryInterface;
use App\Contracts\Repositories\UserRepositoryInterface;
use App\Repositories\AccountRepository;
use App\Repositories\ActivityLogRepository;
use App\Repositories\ContactRepository;
use App\Repositories\DealRepository;
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
        $this->app->bind(ActivityLogRepositoryInterface::class, ActivityLogRepository::class);
        $this->app->bind(UserRepositoryInterface::class, UserRepository::class);
        $this->app->bind(LeadRepositoryInterface::class, LeadRepository::class);
        $this->app->bind(PropertyRepositoryInterface::class, PropertyRepository::class);
        $this->app->bind(AccountRepositoryInterface::class, AccountRepository::class);
        $this->app->bind(ContactRepositoryInterface::class, ContactRepository::class);
        $this->app->bind(DealRepositoryInterface::class, DealRepository::class);
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void {}
}
