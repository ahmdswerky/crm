<?php

namespace App\Enums;

enum PropertyStatus: string
{
    case PENDING = 'pending';

    case SHOWING = 'showing';

    case SOLD = 'sold';
}
