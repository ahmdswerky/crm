<?php

namespace App\Http\Requests\Property;

use App\Enums\PropertyStatus;
use App\Enums\PropertyType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PropertyIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:250'],
            'type' => ['nullable', Rule::enum(PropertyType::class)],
            'status' => ['nullable', Rule::enum(PropertyStatus::class)],
            'city' => ['nullable', 'string', 'max:200'],
            'min_price' => ['nullable', 'numeric', 'min:0', Rule::when($this->filled('max_price'), ['lte:max_price'])],
            'max_price' => ['nullable', 'numeric', 'min:0', Rule::when($this->filled('min_price'), ['gte:min_price'])],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
