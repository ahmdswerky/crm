<?php

namespace App\Http\Requests\Contact;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ContactUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $contactId = $this->route('contact.id');

        return [
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:250'],
            'title' => ['nullable', 'string', 'min:2', 'max:200'],
            'email' => ['nullable', 'email', Rule::unique('contacts', 'email')->ignore($contactId), 'max:250'],
            'phone' => ['sometimes', 'required', 'phone', Rule::unique('contacts', 'phone')->ignore($contactId), 'max:30'],
            'account_id' => ['sometimes', 'required', 'exists:accounts,id'],
        ];
    }
}
