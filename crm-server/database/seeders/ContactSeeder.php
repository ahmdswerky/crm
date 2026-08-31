<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\Contact;
use App\Models\Lead;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use RuntimeException;

class ContactSeeder extends Seeder
{
    public function run(): void
    {
        $chunkSize = 200;
        $startInDays = config('crm.seeds.period.start');
        $inserted = 0;
        $eligibleLeads = Lead::query()
            ->qualified()
            ->assigned()
            ->whereNotNull('company_name')
            ->whereDoesntHave('contact', fn ($query) => $query->withTrashed());
        $count = (clone $eligibleLeads)->count();

        if (! $count) {
            return;
        }

        $accountIds = Account::query()->pluck('id', 'name');
        $progressBar = $this->command->getOutput()->createProgressBar($count);
        $progressBar->setFormat(' %current%/%max% [%bar%] %percent:3s%%');
        $progressBar->start();

        $eligibleLeads
            ->select([
                'id',
                'name',
                'email',
                'phone',
                'company_name',
                'assigned_agent_id',
            ])
            ->chunkById($chunkSize, function (Collection $leads) use (&$inserted, $startInDays, $accountIds, $progressBar): void {
                $now = now();

                $rows = $leads->map(function (Lead $lead) use ($accountIds, $startInDays, $now): array {
                    $accountId = $accountIds->get($lead->company_name);

                    if (! $accountId) {
                        throw new RuntimeException("Cannot seed contact because account [{$lead->company_name}] does not exist.");
                    }

                    return [
                        'account_id' => $accountId,
                        'lead_id' => $lead->id,
                        'name' => $lead->name,
                        'title' => fake()->randomElement([fake()->jobTitle(), null]),
                        'email' => $lead->email,
                        'phone' => $lead->phone,
                        'assigned_agent_id' => $lead->assigned_agent_id,
                        'created_at' => fake()->dateTimeBetween(now()->subDays($startInDays), $now),
                        'updated_at' => $now,
                    ];
                })->all();

                Contact::insert($rows);
                $inserted += count($rows);
                $progressBar->advance(count($rows));
            });

        $progressBar->finish();
        $progressBar->clear();

        $this->command->outputComponents()->success("  {$inserted} contacts generated successfully.");
    }
}
