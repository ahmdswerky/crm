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
            'roles' => RoleResource::collection($this->resource->roles),
            'permissions' => $this->whenLoaded(
                'permissions',
                PermissionResource::collection($this->resource->getAllPermissions()),
            ),
            'created_at' => $this->resource->created_at,
        ];
    }
}
