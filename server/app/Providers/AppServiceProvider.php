<?php

namespace App\Providers;

use App\Models\ActivityLog;
use App\Models\Lead;
use App\Models\Property;
use App\Models\User;
use App\Policies\ActivityLogPolicy;
use App\Policies\LeadPolicy;
use App\Policies\PropertyPolicy;
use App\Policies\UserPolicy;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        Gate::policy(ActivityLog::class, ActivityLogPolicy::class);
        Gate::policy(User::class, UserPolicy::class);
        Gate::policy(Lead::class, LeadPolicy::class);
        Gate::policy(Property::class, PropertyPolicy::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        ResetPassword::createUrlUsing(function (object $notifiable, string $token) {
            return config('app.frontend_url')."/password-reset/$token?email={$notifiable->getEmailForPasswordReset()}";
        });

        Gate::before(function ($user, $ability, $arguments) {
            $target = $arguments[0] ?? null;

            if (is_a($target, ActivityLog::class, true)) {
                return null;
            }

            return $user->is_super ? true : null;
        });
    }
}
