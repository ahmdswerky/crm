<?php

namespace App\Http\Controllers;

use App\Contracts\Repositories\PropertyRepositoryInterface;
use App\Http\Requests\Property\PropertyIndexRequest;
use App\Http\Requests\Property\PropertyStoreRequest;
use App\Http\Requests\Property\PropertyUpdateRequest;
use App\Http\Resources\PropertyResource;
use App\Models\Property;
use Illuminate\Routing\Attributes\Controllers\Authorize;

class PropertyController extends Controller
{
    public function __construct(protected PropertyRepositoryInterface $propertyRepository) {}

    /**
     * Display a listing of the resource.
     */
    #[Authorize('viewAny', Property::class)]
    public function index(PropertyIndexRequest $request)
    {
        $data = $this->propertyRepository->paginate($request->validated());
        $filterInfo = $this->propertyRepository->filtersInfo();

        return PropertyResource::collection($data)
            ->additional([
                'filter' => $filterInfo,
            ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    #[Authorize('create', Property::class)]
    public function store(PropertyStoreRequest $request)
    {
        $property = $this->propertyRepository->store($request->validated());

        return response()->json([
            'property' => PropertyResource::make($property),
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    #[Authorize('view', 'property')]
    public function show(Property $property)
    {
        $property
            ->load(['createdBy', 'media'])
            ->loadCount('deals');

        return response()->json([
            'property' => PropertyResource::make($property),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    #[Authorize('update', 'property')]
    public function update(PropertyUpdateRequest $request, Property $property)
    {
        $property = $this->propertyRepository->update($property, $request->validated());

        return response()->json([
            'property' => PropertyResource::make($property),
        ], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    #[Authorize('delete', 'property')]
    public function destroy(Property $property)
    {
        $this->propertyRepository->delete($property->id);

        return response()->json([], 204);
    }
}
