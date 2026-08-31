<?php

namespace App\Console\Commands;

use App\Services\Payments\PaymentCommandPublisher;
use Illuminate\Console\Command;

class PublishPaymentCommandsCommand extends Command
{
    protected $signature = 'payments:publish {--limit=50}';

    protected $description = 'Publish pending payment commands to RabbitMQ';

    public function handle(PaymentCommandPublisher $publisher): int
    {
        $count = $publisher->publishPending((int) $this->option('limit'));
        $this->info("Published {$count} payment command(s).");

        return self::SUCCESS;
    }
}
