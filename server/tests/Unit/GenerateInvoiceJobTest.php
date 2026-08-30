<?php

use App\Jobs\Invoice\GenerateInvoiceJob;

it('builds the version one invoice command payload for the payment service', function (): void {
    $job = new GenerateInvoiceJob('deal', 42, 'deposit', 1234.5);

    expect($job->type())->toBe('invoice.generate')
        ->and($job->payload())->toBe([
            'invoicable_type' => 'deal',
            'invoicable_id' => 42,
            'type' => 'deposit',
            'value' => '1234.50',
        ]);
});
