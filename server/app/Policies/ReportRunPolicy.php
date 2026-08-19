<?php

namespace App\Policies;

use App\Models\ReportRun;
use App\Models\User;

class ReportRunPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('report.view');
    }

    public function view(User $user, ReportRun $reportRun): bool
    {
        return $user->can('report.view');
    }

    public function download(User $user, ReportRun $reportRun): bool
    {
        return $user->can('report.view') && $reportRun->status === 'completed' && $reportRun->csv_path !== null;
    }
}
