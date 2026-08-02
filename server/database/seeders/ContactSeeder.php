<?php

namespace Database\Seeders;

use App\Enums\LeadStatus;
use App\Models\Contact;
use App\Models\Lead;
use Illuminate\Database\Seeder;

class ContactSeeder extends Seeder
{
    public function run(): void
    {
        $contacts = Contact::factory()
            ->count(50)
            ->create();

        $leadsIds = $contacts->pluck('lead_id')->toArray();

        Lead::whereIn('id', $leadsIds)
            ->update([
                'status' => LeadStatus::QUALIFIED,
            ]);
    }
}
