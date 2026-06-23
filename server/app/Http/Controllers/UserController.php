<?php

namespace App\Http\Controllers;

use App\Contracts\Repositories\UserRepositoryInterface;
use App\Http\Requests\User\UserStoreRequest;
use App\Http\Requests\User\UserUpdateRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Routing\Attributes\Controllers\Authorize;

#[Authorize('user', User::class)]
class UserController extends Controller
{
    public function __construct(protected UserRepositoryInterface $userRepository) {}

    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $data = $this->userRepository->paginate();

        return UserResource::collection($data);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(UserStoreRequest $request)
    {
        $user = $this->userRepository->store($request->validated());

        return response()->json([
            'user' => UserResource::make($user),
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(User $user)
    {
        return response()->json([
            'user' => UserResource::make($user),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UserUpdateRequest $request, User $user)
    {
        $user = $this->userRepository->update($user, $request->validated());

        return response()->json([
            'user' => UserResource::make($user),
        ], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(int $id)
    {
        $this->userRepository->delete($id);

        return response()->json([], 204);
    }
}
