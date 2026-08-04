<?php

namespace App\Http\Requests\Deal;

use App\Enums\DealStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DealUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'deal_value' => ['sometimes', 'required', 'numeric', 'min:5000'],
            'contact_id' => ['sometimes', 'required', 'integer', 'exists:contacts,id'],
            'property_id' => ['sometimes', 'required', 'integer', 'exists:properties,id'],
            'agent_id' => ['sometimes', 'required', 'integer', Rule::exists('users', 'id')],
            'status' => ['sometimes', 'required', Rule::enum(DealStatus::class)],
            'closed_at' => ['nullable', 'date'],
        ];
    }
}
