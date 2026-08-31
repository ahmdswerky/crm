<?php

namespace App\Http\Requests\Lead;

use App\Enums\LeadSource;
use App\Enums\LeadStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

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
            'name' => ['sometimes', 'required', 'min:2', 'max:250'],
            'email' => ['sometimes', 'required', 'email', Rule::unique('leads', 'email')->ignore($leadId), 'max:250'],
            'phone' => ['sometimes', 'required', 'phone', Rule::unique('leads', 'phone')->ignore($leadId), 'max:30'],
            'status' => ['sometimes', 'required', Rule::enum(LeadStatus::class)],
            'city' => ['sometimes', 'required', 'min:2', 'max:200'],
            'address' => ['nullable', 'min:10', 'max:200'],
            'company_name' => ['nullable', 'min:2', 'max:150'],
            'source' => ['nullable', Rule::enum(LeadSource::class)],
            'assigned_agent_id' => ['nullable', 'integer', Rule::exists('users', 'id')],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $lead = $this->route('lead');
            $status = $this->input('status', $lead?->status?->value);

            if ($status !== LeadStatus::QUALIFIED->value) {
                return;
            }

            $companyName = $this->input('company_name', $lead?->company_name);
            if (! is_string($companyName) || trim($companyName) === '') {
                $validator->errors()->add('company_name', 'A company is required before qualifying a lead.');
            }

            if (! $this->input('assigned_agent_id', $lead?->assigned_agent_id)) {
                $validator->errors()->add('assigned_agent_id', 'An assigned agent is required before qualifying a lead.');
            }
        });
    }
}
