<?php

namespace App\Services;

use App\Contracts\Repositories\AccountRepositoryInterface;
use App\Contracts\Repositories\ContactRepositoryInterface;
use App\Enums\LeadStatus;
use App\Models\Contact;
use App\Models\Lead;
use Illuminate\Support\Facades\DB;

class ContactService
{
    public function __construct(
        protected ContactRepositoryInterface $contactRepository,
        protected AccountRepositoryInterface $accountRepository,
    ) {}

    public function createFromQualifiedLead(int $leadId): ?Contact
    {
        return DB::transaction(function () use ($leadId): ?Contact {
            $lead = Lead::query()->lockForUpdate()->findOrFail($leadId);

            if ($lead->status !== LeadStatus::QUALIFIED) {
                return null;
            }

            $existingContact = Contact::withTrashed()
                ->where('lead_id', $lead->id)
                ->first();

            if ($existingContact) {
                return $existingContact;
            }

            if (! $lead->company_name || ! $lead->assigned_agent_id) {
                return null;
            }

            $account = $this->accountRepository->findOrCreateByName($lead->company_name);

            return $this->contactRepository->store([
                'lead_id' => $lead->id,
                'name' => $lead->name,
                'email' => $lead->email,
                'phone' => $lead->phone,
                'account_id' => $account->id,
                'assigned_agent_id' => $lead->assigned_agent_id,
            ]);
        }, 3);
    }
}
