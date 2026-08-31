<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RoleResource extends JsonResource
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
            'guard_name' => $this->resource->guard_name,
            'permissions' => $this->whenLoaded(
                'permissions',
                PermissionResource::collection($this->resource->permissions),
            ),
            'permissions_count' => $this->whenCounted('permissions', fn () => $this->resource->permissions_count),
            'created_at' => $this->resource->created_at,
        ];
    }
}
