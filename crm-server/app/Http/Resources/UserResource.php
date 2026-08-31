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
        $isAgent = $request->user()?->isAgent;

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
            'manager' => $this->whenLoaded('manager', fn () => self::make($this->resource->manager)),
            'team_members' => $this->whenLoaded('teamMemebers', fn () => self::collection($this->resource->teamMemebers)),
            'roles' => $this->whenLoaded('roles', fn () => RoleResource::collection($this->resource->roles)),
            'permissions' => $this->whenLoaded(
                'roles',
                fn () => PermissionResource::collection($this->resource->getAllPermissions()),
            ),
            'commission_rate' => $this->when(! $isAgent, fn () => $this->commissionRate),
            'total_potential_commission' => $this->when(! $isAgent, fn () => $this->whenAppended('totalPotentialCommission', fn () => $this->totalPotentialCommission)),
            'total_actual_commission' => $this->when(! $isAgent, fn () => $this->whenAppended('totalActualCommission', fn () => $this->totalActualCommission)),
            'is_super' => $this->resource->is_super,
            'can_generate_secure_token' => $this->when(
                $request->user()?->is($this->resource),
                fn () => $this->resource->is_super && $this->resource->email === config('app.dev_email'),
            ),
            'created_at' => $this->resource->created_at,
        ];
    }
}
