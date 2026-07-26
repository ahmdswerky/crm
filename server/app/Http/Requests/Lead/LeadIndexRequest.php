<?php

namespace App\Http\Requests\Lead;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class LeadIndexRequest extends FormRequest
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
            'name' => ['sometimes', 'required', 'min:2', 'max:200'],
            'email' => ['sometimes', 'required', 'min:2', 'max:200'],
            'phone' => ['sometimes', 'required', 'min:2', 'max:200'],
            'status' => ['sometimes', 'required', 'min:2', 'max:200'],
            'city' => ['sometimes', 'required', 'min:2', 'max:200'],
            'address' => ['sometimes', 'required', 'min:2', 'max:200'],
            'company_name' => ['sometimes', 'required', 'min:2', 'max:150'],
            'source' => ['sometimes', 'required', 'min:2', 'max:200'],
        ];
    }
}
