<?php

namespace App\Http\Requests\ActivityLog;

use App\Support\Audit\ActivitySubjectRegistry;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ActivityLogIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'subjects' => ['nullable', 'array', 'max:50'],
            'subjects.*' => [
                'required',
                'string',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    try {
                        app(ActivitySubjectRegistry::class)->parse($value);
                    } catch (\InvalidArgumentException) {
                        $fail("The {$attribute} value must use a supported type:id format.");
                    }
                },
            ],
            'event' => ['nullable', 'string', Rule::in(['created', 'updated', 'deleted', 'restored', 'reverted', 'roles_updated', 'password_updated'])],
            'causer_id' => ['nullable', 'integer', 'exists:users,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
