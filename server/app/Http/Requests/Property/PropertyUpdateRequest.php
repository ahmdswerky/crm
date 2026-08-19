<?php

namespace App\Http\Requests\Property;

use App\Enums\PropertyStatus;
use App\Enums\PropertyType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PropertyUpdateRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $propertyId = $this->route('property.id');

        return [
            'title' => ['required', 'min:4', 'max:250', Rule::unique('properties', 'title')->ignore($propertyId)],
            'description' => ['required', 'min:4', 'max:500'],
            'city' => ['required', 'min:2', 'max:200'],
            'address' => ['nullable', 'min:10', 'max:200'],
            'price' => ['required', 'numeric', 'min:5000', 'max:1000000000'],
            'type' => ['sometimes', 'required', Rule::enum(PropertyType::class)],
        ];
    }
}
