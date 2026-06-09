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
            'owner' => $this->whenLoaded('owner', fn () => UserResource::make($this->resource->owner)),
            'title' => $this->resource->title,
            'description' => $this->resource->description,
            'city' => $this->resource->city,
            'address' => $this->resource->address,
            'price' => $this->resource->price,
            'purpose' => $this->resource->purpose,
            'type' => $this->resource->type,
            'status' => $this->resource->status,
            'created_at' => $this->resource->created_at,
        ];
    }
}
