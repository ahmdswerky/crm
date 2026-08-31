<?php

use App\Services\Payments\RabbitMqClient;

it('uses capped exponential reconnect delays with bounded jitter', function (): void {
    config()->set('services.rabbitmq.reconnect_initial_delay_ms', 250);
    config()->set('services.rabbitmq.reconnect_max_delay_ms', 10000);

    $client = app(RabbitMqClient::class);

    expect($client->reconnectDelay(0, 0))->toBe(250)
        ->and($client->reconnectDelay(3, 0))->toBe(2000)
        ->and($client->reconnectDelay(20, 0))->toBe(10000)
        ->and($client->reconnectDelay(0, 50))->toBe(300);
});
