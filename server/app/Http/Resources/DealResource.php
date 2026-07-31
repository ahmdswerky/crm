<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DealResource extends JsonResource
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
            'value' => $this->resource->value,
            'deal_value' => $this->resource->deal_value,
            'contact' => $this->whenLoaded('contact', fn () => ContactResource::make($this->resource->contact)),
            'property' => $this->whenLoaded('property', fn () => PropertyResource::make($this->resource->property)),
            'agent_id' => $this->resource->agent_id,
            'agent' => $this->whenLoaded('agent', fn () => UserResource::make($this->resource->agent)),
            'status' => $this->resource->status,
            'commission_rate' => $this->resource->commission_rate,
            'closed_at' => $this->resource->closed_at,
            'created_at' => $this->resource->created_at,
        ];
    }
}
