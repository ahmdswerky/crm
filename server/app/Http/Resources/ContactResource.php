<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ContactResource extends JsonResource
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
            'title' => $this->resource->title,
            'email' => $this->resource->email,
            'phone' => $this->resource->phone,
            'account' => $this->whenLoaded('account', fn () => AccountResource::make($this->account)),
            'created_at' => $this->resource->created_at,
        ];
    }
}
