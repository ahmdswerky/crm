<?php

namespace App\Http\Requests\Property;

use App\Enums\PropertyType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PropertyStoreRequest extends FormRequest
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
        return [
            'title' => ['required', 'min:4', 'max:250', 'unique:properties,title'],
            'description' => ['required', 'min:4', 'max:500'],
            'city' => ['required', 'min:2', 'max:200'],
            'address' => ['nullable', 'min:10', 'max:200'],
            'price' => ['required', 'numeric', 'min:5000', 'max:1000000000'],
            'type' => ['required', Rule::enum(PropertyType::class)],
            'created_by' => ['nullable', 'integer', Rule::exists('users', 'id')],
        ];
    }

    protected function prepareForValidation()
    {
        $this->merge([
            'created_by' => $this->user()->id,
        ]);
    }
}
