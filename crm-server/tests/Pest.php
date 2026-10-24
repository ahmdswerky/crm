<?php

use App\Enums\LeadStatus;
use App\Enums\PropertyPurpose;
use App\Enums\PropertyStatus;
use App\Enums\PropertyType;
use App\Models\Account;
use App\Models\Contact;
use App\Models\Lead;
use App\Models\Property;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind a different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

/** Converted leads (contacts) for one agent plus pending properties, the inputs DealSeeder needs. */
function seedDealSources(int $contacts, ?int $properties = null): User
{
    $agent = User::factory()->create();
    $account = Account::factory()->create();
    foreach (range(1, $contacts) as $i) {
        $lead = Lead::factory()->create([
            'status' => LeadStatus::QUALIFIED,
            'assigned_agent_id' => $agent->id,
            'company_name' => $account->name,
        ]);
        Contact::query()->create([
            'account_id' => $account->id,
            'lead_id' => $lead->id,
            'name' => $lead->name,
            'email' => $lead->email,
            'phone' => $lead->phone,
            'assigned_agent_id' => $agent->id,
        ]);
    }
    foreach (range(1, $properties ?? $contacts) as $i) {
        Property::query()->create([
            'created_by' => $agent->id,
            'title' => "Seed property {$i}",
            'description' => 'Seed property description',
            'city' => 'Cairo',
            'address' => 'Seed address',
            'price' => 100000,
            'purpose' => PropertyPurpose::SALE,
            'type' => PropertyType::VILLA,
            'status' => PropertyStatus::PENDING,
        ]);
    }

    return $agent;
}
