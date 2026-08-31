<?php

use App\Models\PaymentCommand;
use App\Services\Payments\PaymentCommandPublisher;
use App\Services\Payments\RabbitMqClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Mockery\MockInterface;

uses(RefreshDatabase::class);

it('publishes the invoice generate version one contract fixture', function (): void {
    $fixture = json_decode(
        file_get_contents(sprintf(
            '%s/invoice.generate.v1.json',
            env('PAYMENT_CONTRACTS_PATH', base_path('../docs/contracts/payments')),
        )),
        true,
        512,
        JSON_THROW_ON_ERROR,
    );

    Carbon::setTestNow('2026-08-25 00:00:00 UTC');

    try {
        $command = PaymentCommand::query()->create([
            'message_id' => $fixture['message_id'],
            'correlation_id' => $fixture['correlation_id'],
            'type' => $fixture['type'],
            'version' => $fixture['version'],
            'status' => 'pending',
            'payload' => $fixture['payload'],
        ]);

        $this->mock(RabbitMqClient::class, function (MockInterface $rabbitMq) use ($fixture): void {
            $rabbitMq->shouldReceive('publish')
                ->once()
                ->with(
                    'payments.commands',
                    'invoice.generate',
                    $fixture,
                );
        });

        expect(app(PaymentCommandPublisher::class)->publish($command))->toBeTrue();

        expect($command->fresh())
            ->published_at->toISOString()->toBe('2026-08-25T00:00:00.000000Z')
            ->status->toBe('published');
    } finally {
        Carbon::setTestNow();
    }
});
