<?php

namespace App\Console\Commands;

use App\Services\Payments\PaymentEventCodec;
use App\Services\Payments\PaymentEventProcessor;
use App\Services\Payments\RabbitMqClient;
use Illuminate\Console\Command;
use PhpAmqpLib\Message\AMQPMessage;
use Throwable;

class ConsumePaymentEventsCommand extends Command
{
    protected $signature = 'payments:consume-events';

    protected $description = 'Consume payment completion events from RabbitMQ';

    public function handle(RabbitMqClient $rabbitMq, PaymentEventProcessor $processor, PaymentEventCodec $codec): never
    {
        $queue = (string) config('services.rabbitmq.events_queue');

        $rabbitMq->consume($queue, function (AMQPMessage $message) use ($processor, $codec): void {
            try {
                $event = $codec->decode($message->getBody());
                $processor->apply($event);
                $message->getChannel()->basic_ack($message->getDeliveryTag());
            } catch (Throwable $exception) {
                report($exception);
                $message->getChannel()->basic_nack($message->getDeliveryTag(), false, false);
            }
        });
    }
}
