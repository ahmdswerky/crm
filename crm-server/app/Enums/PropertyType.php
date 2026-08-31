<?php

namespace App\Enums;

enum PropertyType: string
{
    case LAND = 'land';

    case VILLA = 'villa';

    case APPARTMENT = 'appartment';

    case MANSION = 'mansion';

    case COMMERCIAL = 'commercial';
}
