<?php

namespace App\Http\Requests\Media;

use App\Services\MediaOwnerRegistry;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MediaStoreRequest extends FormRequest
{
    public function rules(MediaOwnerRegistry $owners): array
    {
        return [
            'owner_type' => ['required', 'string', Rule::in($owners->types())],
            'owner_id' => ['required', 'integer', 'min:1'],
            'collection' => ['required', 'string', 'max:100'],
            'files' => ['required', 'array', 'min:1', 'max:10'],
            'files.*' => ['required', 'image', 'mimes:jpg,jpeg,png,webp,avif', 'max:10240'],
        ];
    }
}
