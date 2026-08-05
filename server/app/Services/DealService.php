<?php

namespace App\Services;

use App\Contracts\Repositories\DealRepositoryInterface;
use App\Contracts\Repositories\PropertyRepositoryInterface;
use App\Contracts\Repositories\UserRepositoryInterface;
use App\Models\Deal;
use Illuminate\Support\Facades\DB;

class DealService
{
    public function __construct(
        protected DealRepositoryInterface $dealRepository,
        protected PropertyRepositoryInterface $propertyRepository,
        protected UserRepositoryInterface $userRepository,
        protected PropertyStatusResolver $propertyStatusResolver,
    ) {}

    public function store(array $data): Deal
    {
        return DB::transaction(function () use ($data): Deal {
            $propertyId = (int) $data['property_id'];
            $property = $this->propertyRepository->lockByIds([$propertyId])->get($propertyId);
            $agent = $this->userRepository->findById($data['agent_id']);

            $deal = $this->dealRepository->store([
                'value' => $property->price,
                'deal_value' => $data['deal_value'],
                'contact_id' => $data['contact_id'],
                'property_id' => $property->id,
                'agent_id' => $agent->id,
                'commission_rate' => $agent->commissionRate,
                'status' => $data['status'],
                'closed_at' => $data['closed_at'] ?? null,
            ]);

            $this->synchronizePropertyStatus($property->id);

            return $this->dealRepository->find($deal->id);
        }, 3);
    }

    public function update(Deal $deal, array $data): Deal
    {
        return DB::transaction(function () use ($deal, $data): Deal {
            $previousPropertyId = (int) $deal->property_id;
            $nextPropertyId = (int) ($data['property_id'] ?? $previousPropertyId);
            $propertyIds = [$previousPropertyId, $nextPropertyId];

            $this->propertyRepository->lockByIds($propertyIds);

            $deal = $this->dealRepository->update($deal, $data);

            foreach (array_unique($propertyIds) as $propertyId) {
                $this->synchronizePropertyStatus($propertyId);
            }

            return $this->dealRepository->find($deal->id);
        }, 3);
    }

    public function delete(Deal $deal): bool
    {
        return DB::transaction(function () use ($deal): bool {
            $propertyId = (int) $deal->property_id;

            $this->propertyRepository->lockByIds([$propertyId]);

            $deleted = $this->dealRepository->delete($deal->id);

            $this->synchronizePropertyStatus($propertyId);

            return $deleted;
        }, 3);
    }

    public function synchronizePropertyStatus(int $propertyId): void
    {
        $status = $this->propertyStatusResolver->resolve(
            $this->dealRepository->statusesForProperty($propertyId),
        );

        $this->propertyRepository->updateStatus($propertyId, $status);
    }
}
