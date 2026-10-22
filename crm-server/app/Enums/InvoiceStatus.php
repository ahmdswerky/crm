<?php

namespace App\Enums;

enum InvoiceStatus: string
{
    case GENERATED = 'generated';

    case PROCESSING = 'processing';

    case COMPLETED = 'completed';

    case PAID = 'paid';

    case FAILED = 'failed';

    case CANCELED = 'canceled';
}
