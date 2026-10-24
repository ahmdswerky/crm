<?php

namespace Database\Seeders;

use App\Enums\DealStatus;
use App\Models\Activity;
use App\Models\Deal;
use App\Services\Activities\ActivityService;
use App\Support\Activities\ActivityRecords;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ActivitySeeder extends Seeder
{
    private const STAGES = ['inquiry', 'viewing', 'offer_made', 'legal', 'won'];

    public function __construct(
        private readonly ActivityService $activities,
        private readonly ActivityRecords $records,
    ) {}

    public function run(): void
    {
        // Only deals without sales history, so re-running the seeders tops up new deals.
        $deals = Deal::query()
            ->with(['contact', 'property', 'agent'])
            ->whereNotIn('id', DB::table('activity_links')->where('subject_type', 'deal')->select('subject_id'))
            ->get()
            ->filter(fn (Deal $deal) => $deal->contact && $deal->property && $deal->agent);

        if ($deals->isEmpty()) {
            return;
        }

        $progressBar = $this->command->getOutput()->createProgressBar($deals->count());
        $progressBar->setFormat(' %current%/%max% [%bar%] %percent:3s%%');
        $progressBar->start();
        $count = 0;

        DB::transaction(function () use ($deals, $progressBar, &$count): void {
            foreach ($deals as $deal) {
                $count += $this->seedDeal($deal);
                $progressBar->advance();
            }
        });

        $progressBar->finish();
        $progressBar->clear();

        $this->command->outputComponents()->success("  {$count} activities generated for {$deals->count()} deals.");
    }

    private function seedDeal(Deal $deal): int
    {
        $status = $deal->status;
        $closed = in_array($status, [DealStatus::WON, DealStatus::LOST], true);
        $reached = $status === DealStatus::LOST
            ? fake()->randomElement(['inquiry', 'viewing', 'offer_made', 'legal'])
            : $status->value;

        // Steps of stages already passed happen before the deal entered its current status.
        $earlier = [];
        $current = [];
        foreach (self::STAGES as $stage) {
            if ($stage === $reached) {
                $current = $this->stageSteps($stage, $deal);
                break;
            }
            array_push($earlier, ...$this->stageSteps($stage, $deal));
        }
        if ($status === DealStatus::LOST) {
            array_push($current, ...$this->lossSteps($reached, $deal));
        }
        if (! $closed) {
            $current[] = $this->nextStep($reached, $deal);
        }

        $start = CarbonImmutable::parse($deal->created_at)->utc();
        $statusUpdatedAt = CarbonImmutable::parse($deal->status_updated_at ?? $deal->created_at)->utc()->max($start);
        $now = CarbonImmutable::now();
        // Closed deals end when they were won or lost; open ones are still being worked today.
        $times = $closed
            ? $this->timeline($start, $statusUpdatedAt->greaterThan($start) ? $statusUpdatedAt : $now, count($earlier) + count($current))
            : [...$this->timeline($start, $statusUpdatedAt, count($earlier)), ...$this->timeline($statusUpdatedAt, $now, count($current))];
        $end = $closed ? end($times) : $now;

        $previous = $start;
        foreach ([...$earlier, ...$current] as $index => $step) {
            $this->record($deal, $step, $times[$index], $previous, $end);
            $previous = $times[$index];
        }

        return count($times);
    }

    private function stageSteps(string $stage, Deal $deal): array
    {
        $name = $deal->contact->name;
        $title = $deal->property->title;
        $askingPrice = number_format($deal->value);
        $offer = number_format($deal->deal_value);

        return match ($stage) {
            'inquiry' => array_values(array_filter([
                fake()->boolean(35) ? [
                    'kind' => 'call', 'subject' => "Intro call with {$name}", 'outcome' => fake()->randomElement(['unanswered', 'busy', 'voicemail']),
                    'summary' => 'Could not reach the client. Sent a WhatsApp message asking for a better time to call.',
                ] : null,
                [
                    'kind' => 'call', 'subject' => "Discovery call with {$name}", 'outcome' => 'reached',
                    'summary' => fake()->randomElement([
                        "Discussed budget and requirements. Client is interested in {$title} and wants to see it.",
                        "Client asked about payment plans and service charges for {$title}. Interested in a viewing.",
                        "Went through location, size and price of {$title}. Client is comparing two options.",
                    ]),
                ],
                [
                    'kind' => 'email', 'subject' => "Sent brochure and floor plans for {$title}", 'property' => true,
                    'details' => 'Shared the brochure, floor plans and available payment plan options.',
                ],
            ])),
            'viewing' => [
                [
                    'kind' => 'viewing', 'subject' => "Viewing at {$title}", 'property' => true, 'mode' => 'held',
                    'details' => 'Meet the client at the property entrance.', 'outcome' => 'attended',
                    'summary' => fake()->randomElement([
                        'Client liked the layout and natural light. Asked about the monthly service charges.',
                        'Client was positive about the location but wants to check the parking situation.',
                        'Viewing went well. Client will discuss with family and come back with feedback.',
                    ]),
                ],
                [
                    'kind' => 'message', 'subject' => 'WhatsApp follow-up after viewing', 'property' => true,
                    'details' => 'Sent extra photos and the service charge breakdown.',
                ],
            ],
            'offer_made' => [
                [
                    'kind' => 'meeting', 'subject' => "Offer discussion with {$name}", 'property' => true, 'mode' => 'held',
                    'outcome' => 'attended',
                    'summary' => $deal->deal_value == $deal->value
                        ? "Client agreed to the asking price of {$askingPrice}. Offer prepared for the owner."
                        : "Client offered {$offer} against the asking price of {$askingPrice}. Agreed to present it to the owner.",
                ],
                [
                    'kind' => 'note', 'subject' => 'Offer submitted to owner', 'property' => true,
                    'details' => "Written offer of {$offer} for {$title} sent to the owner for approval.",
                ],
            ],
            'legal' => [
                [
                    'kind' => 'task', 'subject' => "Collect ID and proof of funds from {$name}",
                    'details' => 'Copies of national ID and bank statement received.',
                ],
                [
                    'kind' => 'email', 'subject' => 'Sent draft sale contract for review', 'property' => true,
                    'details' => "Draft contract for {$title} shared with the client and their lawyer.",
                ],
            ],
            'won' => [
                [
                    'kind' => 'meeting', 'subject' => "Contract signing for {$title}", 'property' => true, 'mode' => 'held',
                    'outcome' => 'attended', 'summary' => 'Contract signed and deposit received. Handover date to be confirmed with the owner.',
                ],
                [
                    'kind' => 'note', 'subject' => 'Deal closed',
                    'details' => "Final price {$offer}. Commission paperwork submitted.",
                ],
            ],
        };
    }

    private function lossSteps(string $reached, Deal $deal): array
    {
        $reason = fake()->randomElement(in_array($reached, ['offer_made', 'legal'], true)
            ? ['the owner rejected the final offer', 'financing was not approved', 'the client bought a different property']
            : ['the client bought a different property', 'the budget no longer fits the asking price', 'the client postponed the purchase']);
        $title = $deal->property->title;

        return array_values(array_filter([
            in_array($reached, ['inquiry', 'viewing'], true) && fake()->boolean(50) ? [
                'kind' => 'viewing', 'subject' => ($reached === 'inquiry' ? 'Viewing' : 'Second viewing')." at {$title}",
                'property' => true, 'mode' => 'cancelled', 'details' => 'Client cancelled the appointment.',
            ] : null,
            [
                'kind' => 'call', 'subject' => "Follow-up call with {$deal->contact->name}", 'outcome' => 'reached',
                'summary' => "Client decided not to proceed: {$reason}.",
            ],
            ['kind' => 'note', 'subject' => 'Deal marked as lost', 'details' => 'Reason: '.Str::ucfirst($reason).'.'],
        ]));
    }

    private function nextStep(string $stage, Deal $deal): array
    {
        $name = $deal->contact->name;
        $title = $deal->property->title;

        return ['mode' => 'upcoming'] + match ($stage) {
            'inquiry' => [
                'kind' => 'viewing', 'subject' => "Viewing at {$title}", 'property' => true,
                'details' => 'Confirm the visit with the client a day before.',
            ],
            'viewing' => fake()->randomElement([
                ['kind' => 'call', 'subject' => "Get viewing feedback from {$name}"],
                ['kind' => 'viewing', 'subject' => "Second viewing at {$title}", 'property' => true, 'details' => 'Client wants to bring family members.'],
            ]),
            'offer_made' => [
                'kind' => 'task', 'subject' => "Get owner response on the offer for {$title}", 'property' => true,
            ],
            'legal' => fake()->randomElement([
                ['kind' => 'meeting', 'subject' => "Contract signing for {$title}", 'property' => true, 'details' => 'Bring the final contract copies and receipt book.'],
                ['kind' => 'task', 'subject' => 'Follow up with the lawyer on contract review'],
            ]),
        };
    }

    /**
     * Sorted random moments within Cairo working hours (09:00-19:00) between the bounds.
     */
    private function timeline(CarbonImmutable $from, CarbonImmutable $to, int $count): array
    {
        if (! $count) {
            return [];
        }
        $timezone = config('activities.timezone');
        $windows = [];
        for ($day = $from->setTimezone($timezone)->startOfDay(); $day->lessThanOrEqualTo($to); $day = $day->addDay()) {
            $open = $day->setTime(9, 0)->max($from);
            $close = $day->setTime(19, 0)->min($to);
            if ($close->greaterThan($open)) {
                $windows[] = [$open->utc(), $close->getTimestamp() - $open->getTimestamp()];
            }
        }
        $available = array_sum(array_column($windows, 1));

        // ponytail: too little working time left (e.g. created this evening), so space evenly instead.
        if ($available < $count * 900) {
            $span = max($to->getTimestamp() - $from->getTimestamp(), 0);

            return array_map(fn (int $i) => $from->addSeconds(intdiv($span * ($i + 1), $count + 1)), range(0, $count - 1));
        }

        $offsets = array_map(fn () => fake()->numberBetween(0, $available - 1), range(1, $count));
        sort($offsets);

        return array_map(function (int $offset) use ($windows): CarbonImmutable {
            foreach ($windows as [$open, $length]) {
                if ($offset < $length) {
                    return $open->addSeconds($offset)->startOfMinute();
                }
                $offset -= $length;
            }
        }, $offsets);
    }

    private function record(Deal $deal, array $step, CarbonImmutable $at, CarbonImmutable $previous, CarbonImmutable $end): void
    {
        $kind = $step['kind'];
        $mode = $step['mode'] ?? 'logged';
        $minutes = match ($kind) {
            'call' => fake()->numberBetween(5, 20),
            'meeting', 'viewing' => fake()->randomElement([30, 45, 60]),
            default => 0,
        };
        $base = [
            'kind' => $kind, 'subject' => $step['subject'], 'details' => $step['details'] ?? null,
            'creator_id' => $deal->agent_id, 'assignee_id' => $deal->agent_id, 'version' => 1,
        ];

        if ($mode === 'logged') {
            $this->create($deal, $step, $base + [
                'status' => 'completed', 'occurred_at' => $at,
                'outcome' => $step['outcome'] ?? null, 'summary' => $step['summary'] ?? null,
            ], $at->addMinutes($minutes)->min($end), $at);

            return;
        }

        if ($mode === 'upcoming') {
            $local = CarbonImmutable::now(config('activities.timezone'))->addDays(fake()->numberBetween(1, 6))
                ->setTime(fake()->numberBetween(10, 17), fake()->randomElement([0, 30]));
            $schedule = $kind === 'task'
                // Some deadlines already slipped, so the overdue indicators have data.
                ? ['due_date' => $at->setTimezone(config('activities.timezone'))->addDays(fake()->numberBetween(1, 5))->toDateString()]
                : ['starts_at' => $local->utc(), 'ends_at' => $local->addMinutes($minutes)->utc()];
            $this->create($deal, $step, $base + ['status' => 'scheduled'] + $schedule, $at, $at);

            return;
        }

        // Held appointments were booked ahead, cancelled ones were booked for later and called off.
        $startsAt = $mode === 'held' ? $at : $at->addDays(fake()->numberBetween(1, 3));
        $bookedAt = $mode === 'held' ? $at->subDays(fake()->numberBetween(1, 2))->max($previous) : $at;
        $activity = $this->create($deal, $step, $base + [
            'status' => 'scheduled', 'starts_at' => $startsAt, 'ends_at' => $startsAt->addMinutes($minutes),
        ], $bookedAt, $bookedAt);

        $changedAt = $mode === 'held'
            ? $startsAt->addMinutes($minutes + fake()->numberBetween(5, 90))->min($end)
            : $at->addMinutes(fake()->numberBetween(30, 180))->min($end);
        $before = $this->activities->snapshot($activity);
        $activity->forceFill($mode === 'held'
            ? ['status' => 'completed', 'occurred_at' => $startsAt, 'outcome' => $step['outcome'], 'summary' => $step['summary']]
            : ['status' => 'cancelled'])
            ->forceFill(['version' => 2, 'updated_at' => $changedAt])
            ->save();
        $this->event($activity, $activity->status, $before, $changedAt);
    }

    private function create(Deal $deal, array $step, array $attributes, CarbonImmutable $createdAt, CarbonImmutable $eventAt): Activity
    {
        $activity = Activity::query()->create($attributes + ['created_at' => $createdAt, 'updated_at' => $createdAt]);
        $subjects = ['deal' => $deal, 'contact' => $deal->contact] + (($step['property'] ?? false) ? ['property' => $deal->property] : []);
        foreach ($subjects as $type => $record) {
            $activity->links()->create(['subject_type' => $type, 'subject_id' => $record->getKey(), 'label' => $this->records->label($record)]);
        }
        $this->event($activity, 'created', [], $eventAt);

        return $activity;
    }

    private function event(Activity $activity, string $action, array $before, CarbonImmutable $at): void
    {
        $event = $activity->events()->create([
            'event_id' => (string) Str::uuid(), 'actor_id' => $activity->creator_id,
            'actor_name' => $activity->creator()->value('name'), 'action' => $action, 'before' => $before,
            'after' => $this->activities->snapshot($activity->fresh(['links', 'assignee'])),
            'occurred_at' => $at, 'created_at' => $at,
        ]);
        // Seeded history is already projected, so the recovery command has nothing to queue.
        DB::table('activity_history_entries')->insert(['activity_event_id' => $event->id, 'recorded_at' => $at]);
    }
}
