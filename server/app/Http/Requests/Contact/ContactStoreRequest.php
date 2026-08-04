<?php

namespace App\Http\Requests\Contact;

use App\Enums\LeadStatus;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ContactStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['nullable', 'string', 'max:200'],
            'email' => ['nullable', 'email', 'unique:contacts,email', 'max:250'],
            'phone' => ['nullable', 'phone', 'unique:contacts,phone', 'max:30'],
            'account_id' => ['nullable', 'exists:accounts,id'],
            'lead_id' => [
                'required',
                Rule::exists('leads', 'id')->where(function (Builder $query) {
                    $query->whereIn('status', [LeadStatus::PENDING, LeadStatus::CONTACTED])
                        ->whereNotExists(function (Builder $contactQuery) {
                            $contactQuery
                                ->selectRaw('1')
                                ->from('contacts')
                                ->whereColumn('contacts.lead_id', 'leads.id')
                                ->whereNull('contacts.deleted_at');
                        });
                }),
            ],
        ];
    }
}
