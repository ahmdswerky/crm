<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AccountStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'unique:accounts,name', 'max:250'],
            'industry' => ['required', 'min:2', 'max:200'],
            'phone' => ['required', 'phone', 'unique:accounts,phone', 'max:30'],
            'address' => ['nullable', 'string', 'min:10', 'max:200'],
        ];
    }
}
