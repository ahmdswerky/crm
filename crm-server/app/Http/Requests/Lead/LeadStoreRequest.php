<?php

namespace App\Http\Requests\Lead;

use App\Enums\LeadSource;
use App\Enums\LeadStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LeadStoreRequest extends FormRequest
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
            'name' => ['required', 'min:2', 'max:250'],
            'email' => ['required', 'email', 'unique:leads,email', 'max:250'],
            'phone' => ['required', 'phone', 'unique:leads,phone', 'max:250'],
            'status' => ['nullable', Rule::in([
                LeadStatus::PENDING->value,
                LeadStatus::CONTACTED->value,
            ])],
            'city' => ['required', 'min:2', 'max:200'],
            'address' => ['nullable', 'min:10', 'max:200'],
            'company_name' => ['nullable', 'min:2', 'max:150'],
            'source' => ['nullable', Rule::enum(LeadSource::class)],
        ];
    }
}
