<?php

namespace App\Http\Requests\Media;

use App\Services\MediaOwnerRegistry;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MediaReorderRequest extends FormRequest
{
    public function rules(MediaOwnerRegistry $owners): array
    {
        return [
            'owner_type' => ['required', 'string', Rule::in($owners->types())],
            'owner_id' => ['required', 'integer', 'min:1'],
            'collection' => ['required', 'string', 'max:100'],
            'media_ids' => ['required', 'array', 'min:1'],
            'media_ids.*' => ['required', 'integer', 'distinct'],
        ];
    }
}
