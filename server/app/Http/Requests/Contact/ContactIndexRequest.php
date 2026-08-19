<?php

namespace App\Http\Requests\Contact;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ContactIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:250'],
            'title' => ['nullable', 'string', 'max:250'],
            'account' => ['nullable', 'integer', Rule::exists('accounts', 'id')],
            'created_from' => ['nullable', 'date'],
            'created_to' => ['nullable', 'date', 'after_or_equal:created_from'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
