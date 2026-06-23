<?php

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AccountUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $accountId = $this->route('account.id');

        return [
            'name' => ['sometimes', 'required', 'string', 'unique:accounts,name', 'max:250'],
            'industry' => ['nullable', 'string', 'min:2', 'max:200'],
            'phone' => ['sometimes', 'required', 'phone', Rule::unique('leads', 'phone')->ignore($accountId), 'max:30'],
            'address' => ['nullable', 'string', 'min:10', 'max:200'],
        ];
    }
}
