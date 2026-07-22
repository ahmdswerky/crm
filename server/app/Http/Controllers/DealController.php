<?php

namespace App\Http\Controllers;

use App\Contracts\Repositories\DealRepositoryInterface;
use App\Http\Requests\Deal\DealStoreRequest;
use App\Http\Requests\Deal\DealUpdateRequest;
use App\Http\Resources\DealResource;
use App\Models\Deal;
use Illuminate\Routing\Attributes\Controllers\Authorize;

class DealController extends Controller
{
    public function __construct(protected DealRepositoryInterface $dealRepository) {}

    #[Authorize('viewAny', Deal::class)]
    public function index()
    {
        $data = $this->dealRepository->paginate();

        return DealResource::collection($data);
    }

    #[Authorize('create', Deal::class)]
    public function store(DealStoreRequest $request)
    {
        $deal = $this->dealRepository->store($request->validated());

        return response()->json([
            'deal' => DealResource::make($deal),
        ], 201);
    }

    #[Authorize('view', 'deal')]
    public function show(Deal $deal)
    {
        $deal->load(['contact', 'property']);

        return response()->json([
            'deal' => DealResource::make($deal),
        ]);
    }

    #[Authorize('update', 'deal')]
    public function update(DealUpdateRequest $request, Deal $deal)
    {
        $deal = $this->dealRepository->update($deal, $request->validated());

        return response()->json([
            'deal' => DealResource::make($deal),
        ]);
    }

    #[Authorize('delete', 'deal')]
    public function destroy(Deal $deal)
    {
        $this->dealRepository->delete($deal->id);

        return response()->json([], 204);
    }
}
