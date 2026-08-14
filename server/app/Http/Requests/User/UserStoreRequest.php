<?php

namespace App\Http\Requests\User;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UserStoreRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $canManageRoles = (bool) $this->user()->is_super;

        return [
            'name' => ['required', 'min:4', 'max:250'],
            'username' => ['required', 'min:4', 'unique:users,username', 'max:250'],
            'email' => ['required', 'email', 'unique:users,email', 'max:250'],
            'phone' => ['required', 'phone', 'unique:users,phone', 'max:30'],
            'password' => ['required', 'min:6', 'max:100'],
            'direct_manager_id' => ['sometimes', 'nullable', 'exists:users,id'],
            'roles' => $canManageRoles ? 'array|min:1' : 'prohibited',
            'roles.*' => [
                'required',
                Rule::exists(config('permission.table_names.roles'), 'name'),
            ],
        ];
    }
}
