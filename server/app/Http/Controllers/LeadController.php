<?php

namespace App\Http\Controllers;

use App\Contracts\Repositories\LeadRepositoryInterface;
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

        return LeadResource::collection($data);
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
        $lead->load('contact');

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
