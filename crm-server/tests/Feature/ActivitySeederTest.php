<?php

use App\Enums\DealStatus;
use App\Models\Activity;
use App\Models\Deal;
use App\Services\Activities\ActivityService;
use Database\Seeders\ActivitySeeder;
use Database\Seeders\DealSeeder;
use Illuminate\Support\Facades\DB;

test('activity seeder gives every deal a coherent, valid sales history', function () {
    seedDealSources(60);

    $this->seed(DealSeeder::class);
    $this->seed(ActivitySeeder::class);
    $count = Activity::query()->count();
    $this->seed(ActivitySeeder::class);

    expect(Activity::query()->count())->toBe($count)
        ->and(DB::table('activity_events')->count())->toBe(DB::table('activity_history_entries')->count());

    foreach (Deal::query()->get() as $deal) {
        $activities = Activity::query()->with('events')
            ->whereHas('links', fn ($query) => $query->where('subject_type', 'deal')->where('subject_id', $deal->id))
            ->get();
        $closed = in_array($deal->status, [DealStatus::WON, DealStatus::LOST], true);

        expect($activities)->not->toBeEmpty()
            ->and($activities->where('status', 'scheduled')->count())->toBe($closed ? 0 : 1);

        foreach ($activities as $activity) {
            expect($activity->assignee_id)->toBe($deal->agent_id)
                ->and($activity->version)->toBe($activity->events->count())
                ->and($activity->events->first()->action)->toBe('created')
                ->and($activity->events->first()->after['version'])->toBe(1)
                ->and($activity->created_at->greaterThanOrEqualTo($deal->created_at))->toBeTrue();

            if ($activity->status === 'completed') {
                expect($activity->occurred_at->isFuture())->toBeFalse();
                if (isset(ActivityService::OUTCOMES[$activity->kind])) {
                    expect(ActivityService::OUTCOMES[$activity->kind])->toContain($activity->outcome)
                        ->and($activity->summary)->not->toBeEmpty();
                } else {
                    expect($activity->outcome)->toBeNull();
                }
            } else {
                expect($activity->kind)->not->toBe('note')
                    ->and($activity->occurred_at)->toBeNull()
                    ->and($activity->outcome)->toBeNull();
            }

            if ($activity->status === 'scheduled') {
                expect($activity->kind === 'task' ? (bool) $activity->due_date : $activity->starts_at->isFuture())->toBeTrue();
            }
        }
    }
});
