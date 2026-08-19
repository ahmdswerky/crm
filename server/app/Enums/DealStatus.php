<?php

namespace App\Enums;

enum DealStatus: string
{
    case INQUIRY = 'inquiry';

    case VIEWING = 'viewing';

    case OFFER_MADE = 'offer_made';

    case LEGAL = 'legal';

    case WON = 'won';

    case LOST = 'lost';
}
