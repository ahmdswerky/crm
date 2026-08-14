<?php

namespace App\Enums;

enum CommissionRecipientType: string
{
    case AGENT = 'agent';

    case MANAGER = 'manager';

    case COMPANY = 'company';
}
