<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CommissionAllocationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'recipient_type' => $this->resource->recipient_type,
            'recipient_user_id' => $this->resource->recipient_user_id,
            'recipient' => $this->whenLoaded('recipient', fn () => UserResource::make($this->resource->recipient)),
            'base_amount' => $this->resource->base_amount,
            'rate' => $this->resource->rate,
            'amount' => $this->resource->amount,
            'state' => $this->resource->state,
            'snapshotted_at' => $this->resource->snapshotted_at,
        ];
    }
}
