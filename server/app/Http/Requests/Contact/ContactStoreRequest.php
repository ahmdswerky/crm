<?php

namespace App\Http\Requests\Contact;

use Illuminate\Foundation\Http\FormRequest;

class ContactStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:250'],
            'title' => ['nullable', 'string', 'max:200'],
            'email' => ['nullable', 'email', 'unique:contacts,email', 'max:250'],
            'phone' => ['required', 'phone', 'unique:contacts,phone', 'max:30'],
            'account_id' => ['required', 'exists:accounts,id'],
        ];
    }
}
