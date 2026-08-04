<?php

namespace App\Services;

use App\Contracts\Repositories\AccountRepositoryInterface;
use App\Contracts\Repositories\ContactRepositoryInterface;
use App\Contracts\Repositories\LeadRepositoryInterface;
use App\Enums\LeadStatus;
use App\Models\Contact;
use Arr;
use Illuminate\Support\Facades\DB;

class ContactService
{
    public function __construct(
        protected LeadRepositoryInterface $leadRepository,
        protected ContactRepositoryInterface $contactRepository,
        protected AccountRepositoryInterface $accountRepository,
    ) {}

    public function store(int $leadId, array $extraData = []): Contact
    {
        return DB::transaction(function () use (&$contact, $leadId, $extraData) {
            $lead = $this->leadRepository->findById($leadId);

            $accountId = $extraData['account_id'] ??
                ($this->accountRepository->findOrCreateByName($lead->company_name, $lead->phone))->id;

            $this->leadRepository->updateStatus($lead->id, LeadStatus::QUALIFIED);

            return $this->contactRepository->store([
                'lead_id' => $lead->id,
                'name' => $lead->name,
                'title' => $extraData['title'] ?? null,
                'email' => $lead->email ?? $extraData['email'] ?? null,
                'phone' => $extraData['phone'] ?? $lead->phone,
                'account_id' => $accountId,
                'assigned_agent_id' => $lead->assigned_agent_id ?? Arr::get($extraData, 'assigned_agent_id'),
            ]);
        }, 3);
    }
}
