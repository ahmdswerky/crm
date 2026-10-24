<?php

namespace App\Http\Requests\Activities;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveActivityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $update = $this->route('activity') !== null;

        return [
            'kind' => [$update ? 'prohibited' : 'required', Rule::in(['call', 'email', 'message', 'meeting', 'viewing', 'note', 'task'])],
            'links' => [$update ? 'prohibited' : 'required', 'array', 'min:1', 'max:10'],
            'links.*' => ['string', 'distinct', 'regex:/^(lead|contact|deal|property):[1-9][0-9]*$/D'],
            'subject' => [$update ? 'sometimes' : 'required', 'string', 'max:200'],
            'details' => ['nullable', 'string', 'max:10000'],
            'status' => [$update ? 'sometimes' : 'required', Rule::in(['scheduled', 'completed', 'cancelled', 'voided'])],
            'assignee_id' => ['nullable', 'integer', 'min:1'],
            'due_date' => ['nullable', 'date_format:Y-m-d'],
            'starts_at' => ['nullable', 'date', 'regex:/T.*(?:Z|[+-][0-9]{2}:[0-9]{2})$/'],
            'ends_at' => ['nullable', 'date', 'regex:/T.*(?:Z|[+-][0-9]{2}:[0-9]{2})$/'],
            'occurred_at' => ['nullable', 'date', 'before_or_equal:now', 'regex:/T.*(?:Z|[+-][0-9]{2}:[0-9]{2})$/'],
            'outcome' => ['nullable', 'string', 'max:32'],
            'summary' => ['nullable', 'string', 'max:2000'],
            'version' => [$update ? 'required' : 'prohibited', 'integer', 'min:1'],
        ];
    }
}
