<?php

namespace App\Providers;

use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Contact;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Property;
use App\Models\ReportRun;
use App\Models\Role;
use App\Models\User;
use App\Observers\DealObserver;
use App\Observers\LeadObserver;
use App\Observers\OverviewAnalyticsObserver;
use App\Policies\AccountPolicy;
use App\Policies\ActivityLogPolicy;
use App\Policies\ContactPolicy;
use App\Policies\LeadPolicy;
use App\Policies\PropertyPolicy;
use App\Policies\ReportRunPolicy;
use App\Policies\RolePolicy;
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
        Gate::policy(Contact::class, ContactPolicy::class);
        Gate::policy(Account::class, AccountPolicy::class);
        Gate::policy(Property::class, PropertyPolicy::class);
        Gate::policy(ReportRun::class, ReportRunPolicy::class);
        Gate::policy(Role::class, RolePolicy::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Lead::observe(LeadObserver::class);
        Deal::observe(DealObserver::class);

        foreach ([Account::class, Contact::class, Deal::class, Lead::class, Property::class] as $model) {
            $model::observe(OverviewAnalyticsObserver::class);
        }

        ResetPassword::createUrlUsing(function (object $notifiable, string $token) {
            return config('app.frontend_url')."/password-reset/$token?email={$notifiable->getEmailForPasswordReset()}";
        });

        Gate::before(function ($user, $ability, $arguments) {
            $target = $arguments[0] ?? null;

            if ($target === ActivityLog::class || $target instanceof ActivityLog) {
                return null;
            }

            return $user->is_super ? true : null;
        });
    }
}
