<?php

namespace App\Http\Controllers;

use App\Contracts\Repositories\LeadRepositoryInterface;
use App\Enums\LeadStatus;
use App\Http\Requests\Lead\LeadIndexRequest;
use App\Http\Requests\Lead\LeadStoreRequest;
use App\Http\Requests\Lead\LeadUpdateRequest;
use App\Http\Resources\LeadResource;
use App\Models\Lead;
use Illuminate\Routing\Attributes\Controllers\Authorize;

class LeadController extends Controller
{
    public function __construct(protected LeadRepositoryInterface $leadRepository) {}

    /**
     * Display a listing of the resource.
     */
    #[Authorize('viewAny', Lead::class)]
    public function index(LeadIndexRequest $request)
    {
        $data = $this->leadRepository->paginate($request->validated());
        $stats = $this->leadRepository->stats();

        return LeadResource::collection($data)
            ->additional([...$stats]);
    }

    #[Authorize('viewAny', Lead::class)]
    public function board(LeadIndexRequest $request)
    {
        $board = $this->leadRepository->board($request->validated());

        return response()->json([
            'stats' => $board['stats'],
            'columns' => collect($board['columns'])->map(fn (array $column): array => [
                'data' => LeadResource::collection($column['data'])->resolve(),
                'total' => $column['total'],
                'next_cursor' => $column['next_cursor'],
                'has_more' => $column['has_more'],
            ])->all(),
        ]);
    }

    #[Authorize('viewAny', Lead::class)]
    public function boardColumn(LeadIndexRequest $request, LeadStatus $status)
    {
        $page = $this->leadRepository->cursorPaginate([
            ...$request->validated(),
            'status' => $status->value,
        ]);

        return response()->json([
            'data' => LeadResource::collection($page->items())->resolve(),
            'next_cursor' => $page->nextCursor()?->encode(),
            'has_more' => $page->hasMorePages(),
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    #[Authorize('create', Lead::class)]
    public function store(LeadStoreRequest $request)
    {
        $lead = $this->leadRepository->store($request->validated());

        return response()->json([
            'lead' => LeadResource::make($lead),
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    #[Authorize('view', 'lead')]
    public function show(Lead $lead)
    {
        $lead->load('contact.account.media', 'assignedAgent.media');

        return response()->json([
            'lead' => LeadResource::make($lead),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    #[Authorize('update', 'lead')]
    public function update(LeadUpdateRequest $request, Lead $lead)
    {
        $lead = $this->leadRepository->update($lead, $request->validated());

        return response()->json([
            'lead' => LeadResource::make($lead),
        ], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    #[Authorize('delete', 'lead')]
    public function destroy(Lead $lead)
    {
        $this->leadRepository->delete($lead->id);

        return response()->json([], 204);
    }
}
