<?php

namespace App\Http\Requests\Deal;

use App\Enums\DealStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DealStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'deal_value' => ['required', 'numeric', 'min:5000'],
            'contact_id' => ['required', 'integer', 'exists:contacts,id'],
            'property_id' => ['required', 'integer', 'exists:properties,id'],
            'agent_id' => ['required', 'integer', Rule::exists('users', 'id')],
            'status' => ['required', Rule::enum(DealStatus::class)],
            'closed_at' => ['nullable', 'date'],
        ];
    }

    protected function prepareForValidation()
    {
        $user = $this->user();

        if ($user->isAgent) {
            $this->merge([
                'agent_id' => $user->id,
            ]);
        }
    }
}
