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
            'value' => ['sometimes', 'required', 'numeric'],
            'deal_value' => ['sometimes', 'required', 'numeric'],
            'contact_id' => ['sometimes', 'required', 'integer', 'exists:contacts,id'],
            'property_id' => ['sometimes', 'required', 'integer', 'exists:properties,id'],
            'status' => ['sometimes', 'required', Rule::enum(DealStatus::class)],
            'commission_rate' => ['sometimes', 'required', 'numeric'],
            'closed_at' => ['nullable', 'datetime'],
        ];
    }
}
