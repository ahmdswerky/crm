<?php

namespace App\Services\Payments;

use App\Models\PaymentCommand;
use App\Models\PaymentEventInbox;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PaymentEventProcessor
{
    /**
     * @param  array<string, mixed>  $event
     */
    public function apply(array $event): bool
    {
        return DB::transaction(function () use ($event): bool {
            $now = now('UTC');
            $inserted = PaymentEventInbox::query()->insertOrIgnore([
                'event_id' => $event['event_id'],
                'correlation_id' => $event['correlation_id'],
                'type' => $event['type'],
                'version' => $event['version'],
                'source' => $event['source'],
                'payload' => json_encode($event['payload'], JSON_THROW_ON_ERROR),
                'received_at' => $now,
                'applied_at' => $now,
            ]);

            if ($inserted === 0) {
                return false;
            }

            $command = PaymentCommand::query()
                ->where('correlation_id', $event['correlation_id'])
                ->lockForUpdate()
                ->first();

            if ($command === null) {
                throw new RuntimeException('Payment event has no matching command.');
            }

            $isFailure = $event['type'] === 'invoice.failed';
            $payload = $event['payload'];

            $command->forceFill([
                'status' => $isFailure ? 'failed' : 'completed',
                'result' => $payload,
                'completed_at' => $now,
                'failure_code' => $isFailure ? ($payload['failure_code'] ?? 'payment_failed') : null,
                'failure_message' => $isFailure ? ($payload['failure_message'] ?? null) : null,
            ])->save();

            return true;
        });
    }
}
