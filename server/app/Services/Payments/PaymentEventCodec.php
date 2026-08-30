<?php

namespace App\Services\Payments;

use InvalidArgumentException;
use JsonException;

class PaymentEventCodec
{
    /**
     * @return array{
     *     event_id: string,
     *     correlation_id: string,
     *     type: 'invoice.completed'|'invoice.failed',
     *     version: int,
     *     source: 'payments',
     *     occurred_at: string,
     *     payload: array<string, mixed>
     * }
     */
    public function decode(string $body): array
    {
        try {
            $event = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new InvalidArgumentException('Malformed payment event.', previous: $exception);
        }

        if (! is_array($event)) {
            throw new InvalidArgumentException('Unsupported payment event.');
        }

        return $this->validate($event);
    }

    /**
     * @param  array<string, mixed>  $event
     * @return array{
     *     event_id: string,
     *     correlation_id: string,
     *     type: 'invoice.completed'|'invoice.failed',
     *     version: int,
     *     source: 'payments',
     *     occurred_at: string,
     *     payload: array<string, mixed>
     * }
     */
    public function validate(array $event): array
    {
        $eventId = $event['event_id'] ?? null;
        $correlationId = $event['correlation_id'] ?? null;
        $type = $event['type'] ?? null;
        $version = $event['version'] ?? null;
        $source = $event['source'] ?? null;
        $occurredAt = $event['occurred_at'] ?? null;
        $payload = $event['payload'] ?? null;

        if (
            ! $this->isUuid($eventId)
            || ! $this->isUuid($correlationId)
            || ! in_array($type, ['invoice.completed', 'invoice.failed'], true)
            || $version !== 1
            || $source !== 'payments'
            || ! is_string($occurredAt)
            || strtotime($occurredAt) === false
            || ! is_array($payload)
            || ! $this->hasValidPayload($type, $payload)
        ) {
            throw new InvalidArgumentException('Unsupported payment event.');
        }

        return [
            'event_id' => $eventId,
            'correlation_id' => $correlationId,
            'type' => $type,
            'version' => $version,
            'source' => $source,
            'occurred_at' => $occurredAt,
            'payload' => $payload,
        ];
    }

    /**
     * @param  'invoice.completed'|'invoice.failed'  $type
     * @param  array<string, mixed>  $payload
     */
    private function hasValidPayload(string $type, array $payload): bool
    {
        if ($type === 'invoice.completed') {
            return isset($payload['invoice_id'])
                && is_int($payload['invoice_id'])
                && isset($payload['status'])
                && is_string($payload['status'])
                && $payload['status'] !== ''
                && isset($payload['message_id'])
                && $this->isUuid($payload['message_id']);
        }

        return isset($payload['failure_code'])
            && is_string($payload['failure_code'])
            && $payload['failure_code'] !== ''
            && isset($payload['failure_message'])
            && is_string($payload['failure_message'])
            && $payload['failure_message'] !== '';
    }

    private function isUuid(mixed $value): bool
    {
        return is_string($value)
            && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $value) === 1;
    }
}
