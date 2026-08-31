<?php

namespace App\Services;

use App\Enums\DealStatus;
use App\Enums\PropertyStatus;

class PropertyStatusResolver
{
    /**
     * @param  iterable<DealStatus|string>  $dealStatuses
     */
    public function resolve(iterable $dealStatuses): PropertyStatus
    {
        $hasActiveShowing = false;

        foreach ($dealStatuses as $dealStatus) {
            $dealStatus = $dealStatus instanceof DealStatus
                ? $dealStatus
                : DealStatus::from($dealStatus);

            if ($dealStatus === DealStatus::WON) {
                return PropertyStatus::SOLD;
            }

            if (in_array($dealStatus, [
                DealStatus::VIEWING,
                DealStatus::OFFER_MADE,
                DealStatus::LEGAL,
            ], true)) {
                $hasActiveShowing = true;
            }
        }

        return $hasActiveShowing
            ? PropertyStatus::SHOWING
            : PropertyStatus::PENDING;
    }
}
