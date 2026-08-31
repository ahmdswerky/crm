<?php

namespace App\Enums;

enum LeadSource: string
{
    case FACEBOOK = 'facebook';

    case WHATSAPP = 'whatsapp';

    case INSTAGRAM = 'instagram';

    case X = 'x';
}
