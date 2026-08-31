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
            'commission' => [
                'status' => $this->resource->commission_status,
                'version' => $this->resource->commission_version,
                'agent_amount' => $this->resource->commission_agent_amount,
                'manager_amount' => $this->resource->commission_manager_amount,
                'company_amount' => $this->resource->commission_company_amount,
                'total_amount' => $this->resource->commission_total_amount,
                'calculated_at' => $this->resource->commission_calculated_at,
                'finalized_at' => $this->resource->commission_finalized_at,
                'allocations' => $this->when(
                    $this->resource->relationLoaded('allocations'),
                    fn () => CommissionAllocationResource::collection(
                        $this->resource->allocations
                            ->where('version', $this->resource->commission_version)
                            ->values(),
                    ),
                ),
            ],
            'closed_at' => $this->resource->closed_at,
            'created_at' => $this->resource->created_at,
        ];
    }
}
