<?php

namespace App\Http\Requests\Auth;

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
        return [
            'name' => ['sometimes', 'required', 'min:4', 'max:250'],
            'username' => [
                'sometimes',
                'required',
                'min:4',
                Rule::unique('users', 'username')->ignore($this->user()->id),
                'max:250',
            ],
            'email' => [
                'sometimes',
                'required',
                'email',
                Rule::unique('users', 'email')->ignore($this->user()->id),
                'max:250',
            ],
            'phone' => [
                'sometimes',
                'required',
                'phone',
                Rule::unique('users', 'phone')->ignore($this->user()->id),
                'max:30',
            ],
        ];
    }
}
