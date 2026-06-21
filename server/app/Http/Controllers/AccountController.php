<?php

namespace App\Http\Controllers;

use App\Contracts\Repositories\AccountRepositoryInterface;
use App\Http\Requests\AccountStoreRequest;
use App\Http\Requests\AccountUpdateRequest;
use App\Http\Resources\AccountResource;
use App\Models\Account;
use Illuminate\Routing\Attributes\Controllers\Authorize;

class AccountController extends Controller
{
    public function __construct(protected AccountRepositoryInterface $accountRepository) {}

    #[Authorize('viewAny', Account::class)]
    public function index()
    {
        $data = $this->accountRepository->paginate();

        return AccountResource::collection($data);
    }

    #[Authorize('create', Account::class)]
    public function store(AccountStoreRequest $request)
    {
        $account = $this->accountRepository->store($request->validated());

        return response()->json([
            'account' => AccountResource::make($account),
        ], 201);
    }

    #[Authorize('view', 'account')]
    public function show(Account $account)
    {
        return response()->json([
            'account' => AccountResource::make($account),
        ]);
    }

    #[Authorize('update', 'account')]
    public function update(AccountUpdateRequest $request, Account $account)
    {
        $account = $this->accountRepository->update($account, $request->validated());

        return response()->json([
            'account' => AccountResource::make($account),
        ]);
    }

    #[Authorize('delete', 'account')]
    public function destroy(Account $account)
    {
        $this->accountRepository->delete($account->id);

        return response()->json([], 204);
    }
}
