<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeadResource extends JsonResource
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
            'email' => $this->resource->email,
            'phone' => $this->resource->phone,
            'status' => $this->resource->status->value,
            'city' => $this->resource->city,
            'address' => $this->resource->address,
            'company_name' => $this->resource->company_name,
            'source' => $this->resource->source,
            'assigned_agent_id' => $this->resource->assigned_agent_id,
            'assigned_agent' => $this->whenLoaded(
                'assignedAgent',
                fn () => UserResource::make($this->resource->assignedAgent),
            ),
            'created_at' => $this->resource->created_at,
        ];
    }
}
