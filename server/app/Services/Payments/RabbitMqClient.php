<?php

namespace App\Services\Payments;

use PhpAmqpLib\Channel\AMQPChannel;
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;

class RabbitMqClient
{
    private ?AMQPStreamConnection $connection = null;

    private ?AMQPChannel $channel = null;

    public function publish(string $exchange, string $routingKey, array $body, array $headers = []): void
    {
        $channel = $this->channel();
        $message = new AMQPMessage(json_encode($body, JSON_THROW_ON_ERROR), [
            'content_type' => 'application/json',
            'delivery_mode' => 2,
            'application_id' => 'crm',
            'type' => (string) ($body['type'] ?? 'message'),
            'message_id' => (string) ($body['message_id'] ?? $body['event_id'] ?? ''),
            'correlation_id' => (string) ($body['correlation_id'] ?? ''),
            'headers' => $headers,
        ]);

        $channel->basic_publish($message, $exchange, $routingKey);
        $channel->wait_for_pending_acks_returns((float) config('services.rabbitmq.read_write_timeout', 5));
    }

    public function consume(string $queue, callable $handler): never
    {
        $channel = $this->channel();
        $channel->basic_qos(0, 10, false);
        $channel->basic_consume($queue, '', false, false, false, false, $handler);

        while ($channel->is_consuming()) {
            $channel->wait();
        }
    }

    public function channel(): AMQPChannel
    {
        if ($this->channel instanceof AMQPChannel) {
            return $this->channel;
        }

        $this->connection = new AMQPStreamConnection(
            host: (string) config('services.rabbitmq.host'),
            port: (int) config('services.rabbitmq.port'),
            user: (string) config('services.rabbitmq.user'),
            password: (string) config('services.rabbitmq.password'),
            vhost: (string) config('services.rabbitmq.vhost'),
            connection_timeout: (float) config('services.rabbitmq.connection_timeout', 3),
            read_write_timeout: (float) config('services.rabbitmq.read_write_timeout', 5),
            context: [],
            keepalive: true,
            heartbeat: (int) config('services.rabbitmq.heartbeat', 30),
        );
        $this->channel = $this->connection->channel();
        $this->channel->confirm_select();

        return $this->channel;
    }

    public function close(): void
    {
        $this->channel?->close();
        $this->connection?->close();
        $this->channel = null;
        $this->connection = null;
    }

    public function declareTopology(): void
    {
        $channel = $this->channel();
        $commandsExchange = (string) config('services.rabbitmq.commands_exchange');
        $commandsQueue = (string) config('services.rabbitmq.commands_queue');
        $eventsExchange = (string) config('services.rabbitmq.events_exchange');
        $eventsQueue = (string) config('services.rabbitmq.events_queue');

        $channel->exchange_declare($commandsExchange, 'topic', false, true, false);
        $channel->exchange_declare("$commandsExchange.retry", 'topic', false, true, false);
        $channel->exchange_declare("$commandsExchange.dead", 'topic', false, true, false);
        $channel->queue_declare($commandsQueue, false, true, false, false, false, [
            'x-dead-letter-exchange' => ['S', "$commandsExchange.dead"],
        ]);
        $channel->queue_bind($commandsQueue, $commandsExchange, '#');
        $channel->queue_declare("$commandsQueue.retry", false, true, false, false, false, [
            'x-message-ttl' => ['I', 10000],
            'x-dead-letter-exchange' => ['S', $commandsExchange],
        ]);
        $channel->queue_bind("$commandsQueue.retry", "$commandsExchange.retry", '#');
        $channel->queue_declare("$commandsQueue.dead", false, true, false, false);
        $channel->queue_bind("$commandsQueue.dead", "$commandsExchange.dead", '#');

        $channel->exchange_declare($eventsExchange, 'topic', false, true, false);
        $channel->exchange_declare("$eventsExchange.dead", 'topic', false, true, false);
        $channel->queue_declare($eventsQueue, false, true, false, false, false, [
            'x-dead-letter-exchange' => ['S', "$eventsExchange.dead"],
        ]);
        $channel->queue_bind($eventsQueue, $eventsExchange, '#');
        $channel->queue_declare("$eventsQueue.dead", false, true, false, false);
        $channel->queue_bind("$eventsQueue.dead", "$eventsExchange.dead", '#');
    }
}
