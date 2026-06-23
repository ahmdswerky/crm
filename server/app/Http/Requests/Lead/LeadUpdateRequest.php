<?php

namespace App\Http\Requests\Lead;

use App\Enums\LeadSource;
use App\Enums\LeadStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LeadUpdateRequest extends FormRequest
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
        $leadId = $this->route('lead.id');

        return [
            'name' => ['sometimes', 'required', 'min:4', 'max:250'],
            'email' => ['sometimes', 'required', 'email', Rule::unique('leads', 'email')->ignore($leadId), 'max:250'],
            'phone' => ['sometimes', 'required', 'phone', Rule::unique('leads', 'phone')->ignore($leadId), 'max:30'],
            'status' => ['sometimes', 'required', Rule::enum(LeadStatus::class)],
            'city' => ['sometimes', 'required', 'min:2', 'max:200'],
            'address' => ['nullable', 'min:10', 'max:200'],
            'company_name' => ['nullable', 'min:2', 'max:150'],
            'source' => ['nullable', Rule::enum(LeadSource::class)],
        ];
    }
}
