<?php

use App\Enums\DealStatus;
use App\Enums\PropertyStatus;
use App\Services\PropertyStatusResolver;

test('it resolves property status from all deal statuses', function (array $dealStatuses, PropertyStatus $expected) {
    $status = (new PropertyStatusResolver)->resolve($dealStatuses);

    expect($status)->toBe($expected);
})->with([
    'no deals are pending' => [[], PropertyStatus::PENDING],
    'inquiries and losses are pending' => [[DealStatus::INQUIRY, DealStatus::LOST], PropertyStatus::PENDING],
    'viewing is showing' => [[DealStatus::INQUIRY, DealStatus::VIEWING], PropertyStatus::SHOWING],
    'an offer is showing' => [[DealStatus::OFFER_MADE], PropertyStatus::SHOWING],
    'legal is showing' => [[DealStatus::LEGAL], PropertyStatus::SHOWING],
    'won takes precedence over showing' => [[DealStatus::LEGAL, DealStatus::WON], PropertyStatus::SOLD],
    'stored string values are supported' => [['lost', 'viewing'], PropertyStatus::SHOWING],
]);
