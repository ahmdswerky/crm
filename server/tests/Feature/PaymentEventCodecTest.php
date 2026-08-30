<?php

use App\Services\Payments\PaymentEventCodec;

function paymentEventFixture(string $name): string
{
    return file_get_contents(base_path("../docs/contracts/payments/{$name}.v1.json"));
}

it('decodes both shared Payments result fixtures', function (): void {
    $codec = app(PaymentEventCodec::class);
    $completion = paymentEventFixture('invoice.completed');
    $failure = paymentEventFixture('invoice.failed');

    expect($codec->decode($completion))
        ->toBe(json_decode($completion, true, 512, JSON_THROW_ON_ERROR))
        ->and($codec->decode($failure))
        ->toBe(json_decode($failure, true, 512, JSON_THROW_ON_ERROR));
});

it('rejects malformed and unsupported Payments events', function (): void {
    $codec = app(PaymentEventCodec::class);
    $unsupported = json_decode(paymentEventFixture('invoice.completed'), true, 512, JSON_THROW_ON_ERROR);
    $unsupported['source'] = 'crm';

    expect(fn (): array => $codec->decode('{'))
        ->toThrow(InvalidArgumentException::class, 'Malformed payment event')
        ->and(fn (): array => $codec->validate($unsupported))
        ->toThrow(InvalidArgumentException::class, 'Unsupported payment event');
});
