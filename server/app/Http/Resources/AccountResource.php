<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AccountResource extends JsonResource
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
            'name' => $this->resource->name,
            'industry' => $this->resource->industry,
            'phone' => $this->resource->phone,
            'address' => $this->resource->address,
            'created_at' => $this->resource->created_at,
        ];
    }
}
