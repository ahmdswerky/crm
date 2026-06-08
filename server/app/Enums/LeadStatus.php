<?php

namespace App\Enums;

enum LeadStatus: string
{
    case PENDING = 'pending';

    case CONTACTED = 'contacted';

    case QUALIFIED = 'qualified';

    case UNQUALIFIED = 'unqualified';
}
