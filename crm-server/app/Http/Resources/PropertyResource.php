<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PropertyResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'createdBy' => $this->whenLoaded('createdBy', fn () => UserResource::make($this->resource->createdBy)),
            'images' => $this->when(
                $this->resource->relationLoaded('media'),
                fn () => MediaResource::collection($this->resource->getMedia('gallery')),
            ),
            'title' => $this->resource->title,
            'description' => $this->resource->description,
            'city' => $this->resource->city,
            'address' => $this->resource->address,
            'price' => $this->resource->price,
            'purpose' => $this->resource->purpose,
            'type' => $this->resource->type,
            'status' => $this->resource->status,
            'deals_count' => $this->whenCounted('deals', fn () => $this->resource->deals_count),
            'created_at' => $this->resource->created_at,
        ];
    }
}
