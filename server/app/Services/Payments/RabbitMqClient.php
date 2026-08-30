<?php

namespace App\Services\Payments;

use Illuminate\Support\Facades\Log;
use PhpAmqpLib\Channel\AMQPChannel;
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;

class RabbitMqClient
{
    private ?AMQPStreamConnection $connection = null;

    private ?AMQPChannel $channel = null;

    public function publish(string $exchange, string $routingKey, array $body, array $headers = []): void
    {
        try {
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
        } catch (\Throwable $exception) {
            $this->close();

            throw $exception;
        }
    }

    public function consume(string $queue, callable $handler): never
    {
        $attempt = 0;

        while (true) {
            try {
                $channel = $this->channel();
                $channel->basic_qos(0, 10, false);
                $channel->basic_consume($queue, '', false, false, false, false, $handler);
                Log::info('RabbitMQ payment event consumer registered.', [
                    'queue' => $queue,
                    'reconnect_attempts' => $attempt,
                ]);
                $attempt = 0;

                while ($channel->is_consuming()) {
                    $channel->wait();
                }

                throw new \RuntimeException('RabbitMQ consumer stopped unexpectedly.');
            } catch (\Throwable $exception) {
                $delay = $this->reconnectDelay($attempt);
                $attempt++;
                Log::warning('RabbitMQ payment event consumer disconnected; reconnecting.', [
                    'attempt' => $attempt,
                    'delay_ms' => $delay,
                    'exception' => $exception::class,
                    'message' => $exception->getMessage(),
                ]);
                $this->close();
                usleep($delay * 1000);
            }
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
        try {
            $this->channel?->close();
        } catch (\Throwable) {
            // The broker may already have closed this channel.
        } finally {
            $this->channel = null;
        }

        try {
            $this->connection?->close();
        } catch (\Throwable) {
            // The broker may already have closed this connection.
        } finally {
            $this->connection = null;
        }
    }

    public function reconnectDelay(int $attempt, ?int $jitter = null): int
    {
        $initial = max(1, (int) config('services.rabbitmq.reconnect_initial_delay_ms', 250));
        $maximum = max($initial, (int) config('services.rabbitmq.reconnect_max_delay_ms', 10000));
        $exponential = min($maximum, $initial * (2 ** min($attempt, 16)));
        $jitter ??= random_int(0, max(1, (int) floor($exponential * 0.2)));

        return $exponential + $jitter;
    }
}
