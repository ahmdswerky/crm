<?php

namespace App\Http\Controllers;

use App\Http\Resources\PermissionResource;
use App\Models\Permission;
use Illuminate\Http\Request;

class PermissionController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->is_super, 403);

        return PermissionResource::collection(
            Permission::query()
                ->orderBy('name')
                ->get(),
        );
    }
}
