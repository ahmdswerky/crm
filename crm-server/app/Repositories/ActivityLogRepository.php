<?php

namespace App\Repositories;

use App\Contracts\Repositories\ActivityLogRepositoryInterface;
use App\Models\ActivityLog;
use App\Support\Audit\ActivitySubjectRegistry;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class ActivityLogRepository implements ActivityLogRepositoryInterface
{
    public function __construct(
        protected ActivityLog $model,
        protected readonly ActivitySubjectRegistry $subjects,
    ) {}

    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = $this->model
            ->query()
            ->inLog('crm')
            ->with(['causer', 'subject'])
            ->when($filters['event'] ?? null, fn (Builder $query, string $event) => $query->forEvent($event))
            ->when($filters['causer_id'] ?? null, fn (Builder $query, int $causerId) => $query->where('causer_id', $causerId))
            ->when($filters['from'] ?? null, fn (Builder $query, string $from) => $query->where('created_at', '>=', $from))
            ->when($filters['to'] ?? null, fn (Builder $query, string $to) => $query->where('created_at', '<=', $to));

        $this->filterBySubjects($query, $filters['subjects'] ?? []);

        return $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(
                perPage: $filters['per_page'] ?? 30,
                page: $filters['page'] ?? null,
            );
    }

    protected function filterBySubjects(Builder $query, array $subjects): void
    {
        if ($subjects === []) {
            return;
        }

        $query->where(function (Builder $query) use ($subjects): void {
            foreach ($subjects as $subject) {
                $parsed = $this->subjects->parse($subject);

                $query->orWhere(function (Builder $query) use ($parsed): void {
                    $model = $parsed['model'];

                    $query
                        ->where('subject_type', (new $model)->getMorphClass())
                        ->where('subject_id', $parsed['id']);
                });
            }
        });
    }
}
