<?php

namespace App\Enums;

enum CommissionAllocationState: string
{
    case ESTIMATE = 'estimate';

    case FINAL = 'final';

    case SUPERSEDED = 'superseded';

    case VOID = 'void';
}
