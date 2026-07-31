<?php

namespace App\Http\Controllers;

use App\Contracts\Repositories\RoleRepositoryInterface;
use App\Http\Requests\Role\RoleStoreRequest;
use App\Http\Requests\Role\RoleUpdateRequest;
use App\Http\Resources\RoleResource;
use App\Models\Role;
use Illuminate\Routing\Attributes\Controllers\Authorize;

class RoleController extends Controller
{
    public function __construct(protected RoleRepositoryInterface $roleRepository) {}

    #[Authorize('viewAny', Role::class)]
    public function index()
    {
        $data = $this->roleRepository->paginate();

        return RoleResource::collection($data);
    }

    #[Authorize('create', Role::class)]
    public function store(RoleStoreRequest $request)
    {
        $role = $this->roleRepository->store($request->validated());

        return response()->json([
            'role' => RoleResource::make($role),
        ], 201);
    }

    #[Authorize('view', 'role')]
    public function show(Role $role)
    {
        return response()->json([
            'role' => RoleResource::make($role),
        ]);
    }

    #[Authorize('update', 'role')]
    public function update(RoleUpdateRequest $request, Role $role)
    {
        $role = $this->roleRepository->update($role, $request->validated());

        return response()->json([
            'role' => RoleResource::make($role),
        ]);
    }

    #[Authorize('delete', 'role')]
    public function destroy(Role $role)
    {
        $this->roleRepository->delete($role->id);

        return response()->json([], 204);
    }
}
