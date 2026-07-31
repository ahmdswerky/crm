<?php

namespace App\Http\Requests\Deal;

use App\Enums\DealStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DealIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:250'],
            'status' => ['nullable', Rule::enum(DealStatus::class)],
            'contact' => ['nullable', 'integer', Rule::exists('contacts', 'id')],
            'property' => ['nullable', 'integer', Rule::exists('properties', 'id')],
            'agent' => ['nullable', 'integer', Rule::exists('users', 'id')],
            'closed_from' => ['nullable', 'date'],
            'closed_to' => ['nullable', 'date', 'after_or_equal:closed_from'],
            'min_value' => ['nullable', 'numeric', 'min:0', Rule::when($this->filled('max_value'), ['lte:max_value'])],
            'max_value' => ['nullable', 'numeric', 'min:0', Rule::when($this->filled('min_value'), ['gte:min_value'])],
            'min_deal_value' => ['nullable', 'numeric', 'min:0', Rule::when($this->filled('max_deal_value'), ['lte:max_deal_value'])],
            'max_deal_value' => ['nullable', 'numeric', 'min:0', Rule::when($this->filled('min_deal_value'), ['gte:min_deal_value'])],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
