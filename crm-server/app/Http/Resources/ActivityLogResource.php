<?php

namespace App\Http\Resources;

use App\Support\Audit\ActivitySubjectRegistry;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ActivityLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $changes = $this->resource->attribute_changes?->all() ?? [];
        $properties = $this->resource->properties?->all() ?? [];
        $subjects = app(ActivitySubjectRegistry::class);
        $subject = $this->resource->relationLoaded('subject') ? $this->resource->subject : null;

        return [
            'id' => $this->resource->id,
            'event' => $this->resource->event,
            'description' => $this->resource->description,
            'subject' => [
                'type' => $subjects->typeForMorphType($this->resource->subject_type),
                'id' => $this->resource->subject_id,
                'label' => $subjects->labelFor($subject),
            ],
            'causer' => [
                'id' => $this->resource->causer_id,
                'name' => $this->resource->causer?->name,
            ],
            'changes' => [
                'before' => $changes['old'] ?? $properties['before'] ?? [],
                'after' => $changes['attributes'] ?? $properties['after'] ?? [],
            ],
            'metadata' => [
                'reverted_activity_id' => $properties['reverted_activity_id'] ?? null,
                'reason' => $properties['reason'] ?? null,
                'restored_attributes' => $properties['restored_attributes'] ?? null,
            ],
            'revert' => [
                'allowed' => $this->resource->log_name === 'crm'
                    && in_array($this->resource->event, ['updated', 'deleted'], true),
            ],
            'created_at' => $this->resource->created_at,
        ];
    }
}
