<?php

namespace App\Jobs\Lead;

use App\Services\ContactService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class LeadConvertionJob implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new job instance.
     */
    public function __construct(public int $leadId)
    {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(ContactService $contactService): void
    {
        $contactService->createFromQualifiedLead($this->leadId);
    }
}
