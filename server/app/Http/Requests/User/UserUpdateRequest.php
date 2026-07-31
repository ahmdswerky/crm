<?php

namespace App\Http\Requests\User;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UserUpdateRequest extends FormRequest
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
        $userId = $this->route('user.id');

        return [
            'name' => ['required', 'min:4', 'max:250'],
            'username' => [
                'required',
                'min:4',
                Rule::unique('users', 'username')->ignore($userId),
                'max:250',
            ],
            'email' => [
                'required',
                'email',
                Rule::unique('users', 'email')->ignore($userId),
                'max:250',
            ],
            'phone' => [
                'required',
                'phone',
                Rule::unique('users', 'phone')->ignore($userId),
                'max:30',
            ],
            'roles' => [$canManageRoles ? 'array' : 'prohibited'],
            'roles.*' => [
                'required',
                Rule::exists(config('permission.table_names.roles'), 'name'),
            ],
        ];
    }
}
