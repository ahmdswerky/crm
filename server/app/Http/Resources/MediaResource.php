<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MediaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $seedImagePath = $this->resource->getCustomProperty('seed_image_path');
        $url = $seedImagePath !== null
            ? asset($seedImagePath)
            : $this->resource->getFullUrl();

        return [
            'id' => $this->resource->id,
            'uuid' => $this->resource->uuid,
            'name' => $this->resource->name,
            'mime_type' => $this->resource->mime_type,
            'size' => $this->resource->size,
            'url' => $url,
            'thumbnail_url' => $seedImagePath !== null
                ? $url
                : $this->resource->getAvailableFullUrl(["{$this->resource->collection_name}-thumbnail"]),
            'order' => $this->resource->order_column,
            'created_at' => $this->resource->created_at,
        ];
    }
}
