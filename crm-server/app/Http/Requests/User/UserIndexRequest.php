<?php

namespace App\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UserIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:250'],
            'role' => ['nullable', 'string', Rule::exists('roles', 'name')],
            'access' => ['nullable', Rule::in(['super', 'standard'])],
            'permission' => ['nullable', 'string', Rule::exists('permissions', 'name')],
            'created_from' => ['nullable', 'date'],
            'created_to' => ['nullable', 'date', 'after_or_equal:created_from'],
            'with' => ['nullable', Rule::in(['manager'])],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
