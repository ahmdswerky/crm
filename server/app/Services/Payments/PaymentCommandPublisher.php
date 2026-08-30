<?php

namespace App\Services\Payments;

use App\Models\PaymentCommand;
use Illuminate\Support\Facades\Log;
use Throwable;

class PaymentCommandPublisher
{
    public function __construct(private readonly RabbitMqClient $rabbitMq) {}

    public function publish(PaymentCommand $command): bool
    {
        if ($command->published_at !== null) {
            return true;
        }

        try {
            $this->rabbitMq->publish(
                (string) config('services.rabbitmq.commands_exchange'),
                $command->type,
                [
                    'message_id' => $command->message_id,
                    'correlation_id' => $command->correlation_id,
                    'type' => $command->type,
                    'version' => $command->version,
                    'source' => 'crm',
                    'occurred_at' => now('UTC')->toISOString(),
                    'payload' => $command->payload,
                ],
            );

            $command->forceFill([
                'status' => 'published',
                'published_at' => now('UTC'),
            ])->save();

            return true;
        } catch (Throwable $exception) {
            Log::warning('Payment command could not be published', [
                'message_id' => $command->message_id,
                'type' => $command->type,
                'exception' => $exception,
            ]);

            return false;
        }
    }

    public function publishPending(int $limit = 50): int
    {
        $published = 0;

        PaymentCommand::query()
            ->whereNull('published_at')
            ->oldest('id')
            ->limit($limit)
            ->get()
            ->each(function (PaymentCommand $command) use (&$published): void {
                if ($this->publish($command)) {
                    $published++;
                }
            });

        return $published;
    }
}
