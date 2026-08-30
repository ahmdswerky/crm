<?php

use App\Models\PaymentCommand;
use App\Models\PaymentEventInbox;
use App\Services\Payments\PaymentEventCodec;
use App\Services\Payments\PaymentEventProcessor;

function paymentResultEvent(array $overrides = []): array
{
    return array_replace([
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
    ], $overrides);
}

function paymentCommandForEvent(array $event): PaymentCommand
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

it('applies a payment completion event once and records its inbox entry', function (): void {
    $event = paymentResultEvent();
    $command = paymentCommandForEvent($event);

    expect(app(PaymentEventProcessor::class)->apply($event))->toBeTrue();

    expect($command->fresh())
        ->status->toBe('completed')
        ->result->toBe($event['payload'])
        ->completed_at->not->toBeNull();

    expect(PaymentEventInbox::query()->find($event['event_id']))
        ->not->toBeNull()
        ->type->toBe('invoice.completed')
        ->payload->toBe($event['payload'])
        ->applied_at->not->toBeNull();
});

it('acknowledges a duplicate event without applying another command transition', function (): void {
    $event = paymentResultEvent();
    $command = paymentCommandForEvent($event);
    $processor = app(PaymentEventProcessor::class);

    expect($processor->apply($event))->toBeTrue();

    $completedAt = $command->fresh()->completed_at;

    expect($processor->apply($event))->toBeFalse();

    expect(PaymentEventInbox::query()->count())->toBe(1)
        ->and($command->fresh()->completed_at->equalTo($completedAt))->toBeTrue();
});

it('applies a payment failure event and preserves failure details', function (): void {
    $event = paymentResultEvent([
        'event_id' => '44444444-4444-4444-8444-444444444444',
        'type' => 'invoice.failed',
        'payload' => [
            'failure_code' => 'invalid_payload',
            'failure_message' => 'Invalid invoice.generate payload',
        ],
    ]);
    $command = paymentCommandForEvent($event);

    expect(app(PaymentEventProcessor::class)->apply($event))->toBeTrue();

    expect($command->fresh())
        ->status->toBe('failed')
        ->result->toBe($event['payload'])
        ->failure_code->toBe('invalid_payload')
        ->failure_message->toBe('Invalid invoice.generate payload');
});

it('rejects an unsupported result event before it reaches the processor', function (): void {
    $event = paymentResultEvent(['type' => 'invoice.cancelled']);

    expect(fn (): array => app(PaymentEventCodec::class)->validate($event))
        ->toThrow(InvalidArgumentException::class, 'Unsupported payment event');

    expect(PaymentEventInbox::query()->count())->toBe(0);
});

it('leaves no inbox entry when a result has no matching command', function (): void {
    $event = paymentResultEvent();

    expect(fn (): bool => app(PaymentEventProcessor::class)->apply($event))
        ->toThrow(RuntimeException::class, 'Payment event has no matching command.');

    expect(PaymentEventInbox::query()->count())->toBe(0);
});
