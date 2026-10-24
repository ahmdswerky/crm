<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class DemoResetCommand extends Command
{
    protected $signature = 'demo:reset';

    protected $description = 'Wipe uploaded media and reseed the database (public demo only)';

    public function handle(): int
    {
        if (! config('crm.demo')) {
            $this->components->error('Refusing to reset: CRM_DEMO is not enabled.');

            return self::FAILURE;
        }

        // migrate:fresh leaves files behind; seeders re-copy seed images from public/seed-images.
        $disk = Storage::disk(config('media-library.disk_name'));
        collect($disk->directories())->each(fn (string $directory) => $disk->deleteDirectory($directory));

        $this->call('migrate:fresh', ['--seed' => true, '--force' => true]);
        $this->call('commission:recalculate', ['--all' => true]);
        $this->call('analytics:backfill', [
            '--from' => today()->subDays(config('crm.seeds.period.start'))->toDateString(),
        ]);

        return self::SUCCESS;
    }
}
