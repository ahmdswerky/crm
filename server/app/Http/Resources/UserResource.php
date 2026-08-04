<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
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
            'username' => $this->resource->username,
            'email' => $this->resource->email,
            'phone' => $this->resource->phone,
            'avatar' => $this->when(
                $this->resource->relationLoaded('media'),
                fn () => ($avatar = $this->resource->getFirstMedia('main')) ? MediaResource::make($avatar) : null,
            ),
            'roles' => $this->whenLoaded('roles', fn () => RoleResource::collection($this->resource->roles)),
            'permissions' => $this->whenLoaded(
                'roles',
                fn () => PermissionResource::collection($this->resource->getAllPermissions()),
            ),
            'commission_rate' => $this->commissionRate,
            'total_potential_commission' => $this->whenAppended('totalPotentialCommission', fn () => $this->totalPotentialCommission),
            'total_actual_commission' => $this->whenAppended('totalActualCommission', fn () => $this->totalActualCommission),
            'is_super' => $this->resource->is_super,
            'created_at' => $this->resource->created_at,
        ];
    }
}
