<?php

use App\Console\Commands\ConsumePaymentEventsCommand;
use App\Models\PaymentCommand;
use App\Services\Payments\PaymentEventCodec;
use App\Services\Payments\PaymentEventProcessor;
use App\Services\Payments\RabbitMqClient;
use Mockery\MockInterface;
use PhpAmqpLib\Channel\AMQPChannel;
use PhpAmqpLib\Message\AMQPMessage;

function consumerPaymentResultEvent(): array
{
    return [
        'event_id' => '33333333-3333-4333-8333-333333333333',
        'correlation_id' => '22222222-2222-4222-8222-222222222222',
        'type' => 'invoice.completed',
        'version' => 1,
        'source' => 'payments',
        'occurred_at' => '2026-08-25T00:00:00.000Z',
        'payload' => [
            'invoice_id' => 7,
            'status' => 'completed',
            'message_id' => '11111111-1111-4111-8111-111111111111',
        ],
    ];
}

function paymentEventMessage(array $event, AMQPChannel $channel): AMQPMessage
{
    return (new AMQPMessage(json_encode($event, JSON_THROW_ON_ERROR)))
        ->setChannel($channel)
        ->setDeliveryInfo(99, false, 'payments.events', $event['type']);
}

function consumerPaymentCommand(array $event): PaymentCommand
{
    return PaymentCommand::query()->create([
        'message_id' => '11111111-1111-4111-8111-111111111111',
        'correlation_id' => $event['correlation_id'],
        'type' => 'invoice.generate',
        'version' => 1,
        'status' => 'published',
        'payload' => [
            'invoicable_type' => 'deal',
            'invoicable_id' => 42,
            'type' => 'deposit',
            'value' => '1234.50',
        ],
        'published_at' => now('UTC'),
    ]);
}

function stopPaymentEventConsumer(): never
{
    throw new RuntimeException('Stop payment event consumer.');
}

it('acknowledges only after the payment event processor applies an event', function (): void {
    $event = consumerPaymentResultEvent();
    $channel = mock(AMQPChannel::class);
    $channel->shouldReceive('basic_ack')->once()->with(99);
    $channel->shouldNotReceive('basic_nack');
    $message = paymentEventMessage($event, $channel);
    $command = consumerPaymentCommand($event);

    $this->mock(RabbitMqClient::class, function (MockInterface $rabbitMq) use ($message): void {
        $rabbitMq->shouldReceive('consume')
            ->once()
            ->with('crm.payment-events', Mockery::type('callable'))
            ->andReturnUsing(function (string $queue, callable $handler) use ($message): never {
                $handler($message);

                stopPaymentEventConsumer();
            });
    });

    $processor = app(PaymentEventProcessor::class);

    expect(fn (): never => app(ConsumePaymentEventsCommand::class)->handle(app(RabbitMqClient::class), $processor, app(PaymentEventCodec::class)))
        ->toThrow(RuntimeException::class, 'Stop payment event consumer.');

    expect($command->fresh()->status)->toBe('completed');
});

it('nacks an event when its processor throws', function (): void {
    $event = consumerPaymentResultEvent();
    $channel = mock(AMQPChannel::class);
    $channel->shouldReceive('basic_nack')->once()->with(99, false, false);
    $channel->shouldNotReceive('basic_ack');
    $message = paymentEventMessage($event, $channel);

    $this->mock(RabbitMqClient::class, function (MockInterface $rabbitMq) use ($message): void {
        $rabbitMq->shouldReceive('consume')
            ->once()
            ->with('crm.payment-events', Mockery::type('callable'))
            ->andReturnUsing(function (string $queue, callable $handler) use ($message): never {
                $handler($message);

                stopPaymentEventConsumer();
            });
    });

    $processor = new class extends PaymentEventProcessor
    {
        public function apply(array $event): bool
        {
            throw new RuntimeException('Database unavailable.');
        }
    };

    expect(fn (): never => app(ConsumePaymentEventsCommand::class)->handle(app(RabbitMqClient::class), $processor, app(PaymentEventCodec::class)))
        ->toThrow(RuntimeException::class, 'Stop payment event consumer.');
});

it('nacks a malformed event before it reaches the processor', function (): void {
    $channel = mock(AMQPChannel::class);
    $channel->shouldReceive('basic_nack')->once()->with(99, false, false);
    $channel->shouldNotReceive('basic_ack');
    $message = (new AMQPMessage('{'))
        ->setChannel($channel)
        ->setDeliveryInfo(99, false, 'payments.events', 'invoice.completed');

    $this->mock(RabbitMqClient::class, function (MockInterface $rabbitMq) use ($message): void {
        $rabbitMq->shouldReceive('consume')
            ->once()
            ->with('crm.payment-events', Mockery::type('callable'))
            ->andReturnUsing(function (string $queue, callable $handler) use ($message): never {
                $handler($message);

                stopPaymentEventConsumer();
            });
    });

    expect(fn (): never => app(ConsumePaymentEventsCommand::class)->handle(
        app(RabbitMqClient::class),
        app(PaymentEventProcessor::class),
        app(PaymentEventCodec::class),
    ))->toThrow(RuntimeException::class, 'Stop payment event consumer.');
});
