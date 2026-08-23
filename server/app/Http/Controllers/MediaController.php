<?php

namespace App\Http\Controllers;

use App\Http\Requests\Media\MediaIndexRequest;
use App\Http\Requests\Media\MediaReorderRequest;
use App\Http\Requests\Media\MediaStoreRequest;
use App\Http\Resources\MediaResource;
use App\Services\MediaOwnerRegistry;
use App\Services\MediaService;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class MediaController extends Controller
{
    public function __construct(
        protected readonly MediaOwnerRegistry $owners,
        protected readonly MediaService $mediaService,
    ) {}

    public function index(MediaIndexRequest $request)
    {
        $owner = $this->owners->resolve($request->string('owner_type')->toString(), $request->integer('owner_id'));
        $collection = $request->string('collection')->toString();
        $this->owners->assertSupportsCollection($owner, $collection);
        return MediaResource::collection($owner->getMedia($collection));
    }

    public function store(MediaStoreRequest $request)
    {
        $owner = $this->owners->resolve($request->string('owner_type')->toString(), $request->integer('owner_id'));
        $collection = $request->string('collection')->toString();
        $this->owners->assertSupportsCollection($owner, $collection);
        $media = $this->mediaService->attach($owner, $request->file('files'), $collection, $request->user());

        return MediaResource::collection($media)
            ->response()
            ->setStatusCode(201);
    }

    public function reorder(MediaReorderRequest $request)
    {
        $owner = $this->owners->resolve($request->string('owner_type')->toString(), $request->integer('owner_id'));
        $collection = $request->string('collection')->toString();
        $this->owners->assertSupportsCollection($owner, $collection);
        $this->mediaService->reorder($owner, $request->validated('media_ids'), $collection, $request->user());

        $owner->unsetRelation('media');

        return MediaResource::collection($owner->getMedia($collection));
    }

    public function destroy(Media $media)
    {
        $owner = $this->owners->resolveMediaOwner($media);
        $this->mediaService->delete($owner, $media, $media->collection_name, request()->user());

        return response()->noContent();
    }
}
