<?php

namespace App\Jobs\Invoice;

final class GenerateInvoiceJob
{
    public function __construct(
        private readonly string $invoicableType,
        private readonly int $invoicableId,
        private readonly string $type,
        private readonly float $value,
    ) {}

    public function type(): string
    {
        return 'invoice.generate';
    }

    /** @return array{invoicable_type: string, invoicable_id: int, type: string, value: string} */
    public function payload(): array
    {
        return [
            'invoicable_type' => $this->invoicableType,
            'invoicable_id' => $this->invoicableId,
            'type' => $this->type,
            'value' => number_format($this->value, 2, '.', ''),
        ];
    }
}
