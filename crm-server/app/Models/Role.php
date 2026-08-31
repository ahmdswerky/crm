<?php

namespace App\Models;

use App\Support\Audit\LogsCrmActivity;

class Role extends \Spatie\Permission\Models\Role
{
    use LogsCrmActivity;
}
