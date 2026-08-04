<?php

namespace App\Http\Controllers;

use App\Contracts\Repositories\UserRepositoryInterface;
use App\Http\Requests\User\UserIndexRequest;
use App\Http\Requests\User\UserStoreRequest;
use App\Http\Requests\User\UserUpdateRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Routing\Attributes\Controllers\Authorize;

class UserController extends Controller
{
    public function __construct(protected UserRepositoryInterface $userRepository) {}

    /**
     * Display a listing of the resource.
     */
    #[Authorize('viewAny', User::class)]
    public function index(UserIndexRequest $request)
    {
        $data = $this->userRepository->paginate($request->validated());

        return UserResource::collection($data);
    }

    /**
     * Store a newly created resource in storage.
     */
    #[Authorize('create', User::class)]
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
    #[Authorize('view', 'user')]
    public function show(User $user)
    {
        $user->load('media');

        $user->append([
            'totalPotentialCommission',
            'totalActualCommission',
        ]);

        return response()->json([
            'user' => UserResource::make($user),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    #[Authorize('update', 'user')]
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
    #[Authorize('delete', 'user')]
    public function destroy(User $user)
    {
        $this->userRepository->delete($user->id);

        return response()->json([], 204);
    }
}
