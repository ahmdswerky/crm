<?php

use App\Enums\PropertyStatus;
use App\Jobs\Activities\RecordActivityHistory;
use App\Models\Activity;
use App\Models\ActivityLog;
use App\Models\Contact;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Permission;
use App\Models\Property;
use App\Models\Role;
use App\Models\User;
use App\Services\Activities\ActivityService;
use Database\Seeders\ActivityPermissionSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

function salesAgent(array $permissions = ['activity.view', 'activity.create', 'activity.edit', 'lead.view', 'property.view', 'contact.view']): User
{
    $user = User::factory()->create(['is_super' => false]);
    $user->assignRole(Role::findOrCreate('agent', 'web'));
    foreach ($permissions as $permission) {
        Permission::findOrCreate($permission, 'web');
        $user->givePermissionTo($permission);
    }

    return $user->fresh();
}

function salesInput(Lead $lead, array $overrides = []): array
{
    return array_replace(['kind' => 'call', 'subject' => 'Follow up', 'status' => 'completed',
        'outcome' => 'reached', 'summary' => 'Discussed the next viewing.', 'links' => ['lead:'.$lead->id]], $overrides);
}

test('sales interactions require authentication and independent permissions', function () {
    $this->getJson('/api/v1/activities')->assertUnauthorized();
    $this->getJson('/api/v1/activity-history')->assertUnauthorized();
    $this->actingAs(salesAgent([]))->getJson('/api/v1/activities')->assertForbidden();
});

test('activity agent choices and assigned people include their actual avatars', function () {
    Storage::fake('public');
    config(['media-library.disk_name' => 'public']);
    $agent = salesAgent();
    $withoutAvatar = salesAgent();
    $media = $agent->addMedia(UploadedFile::fake()->image('agent-avatar.png'))->toMediaCollection('main');
    $media->refresh();
    $lead = Lead::factory()->pending()->create();

    $agents = collect($this->actingAs($agent)->getJson('/api/v1/activities/options')->assertOk()->json('agents'))->keyBy('id');
    expect($agents[$agent->id]['avatar']['url'])->toBe($media->getFullUrl());
    expect($agents[$agent->id]['avatar']['thumbnail_url'])->toBe($media->getAvailableFullUrl(['main-thumbnail']));
    expect($agents[$withoutAvatar->id]['avatar'])->toBeNull();
    expect(array_keys($agents[$agent->id]))->toBe(['id', 'name', 'avatar']);

    $id = $this->postJson('/api/v1/activities', salesInput($lead))->assertCreated()
        ->assertJsonPath('data.assignee.avatar.id', $media->id)->json('data.id');
    $this->getJson('/api/v1/activities/'.$id)->assertOk()
        ->assertJsonPath('data.assignee.avatar.url', $media->getFullUrl())
        ->assertJsonPath('data.creator.avatar.id', $media->id);
    $this->getJson('/api/v1/activities')->assertOk()->assertJsonPath('data.0.assignee.avatar.id', $media->id);
});

test('manual interaction saves its own history and never writes developer logs', function () {
    $agent = salesAgent();
    $lead = Lead::factory()->pending()->create();
    $count = ActivityLog::count();
    $result = $this->actingAs($agent)->postJson('/api/v1/activities', salesInput($lead))->assertCreated()
        ->assertJsonPath('data.assignee_id', $agent->id)->assertJsonPath('data.version', 1);
    $id = $result->json('data.id');
    $this->getJson('/api/v1/activity-history?subject=lead:'.$lead->id)->assertOk()
        ->assertJsonCount(1, 'data')->assertJsonPath('data.0.after.summary', 'Discussed the next viewing.');
    expect(ActivityLog::count())->toBe($count);
    $this->getJson('/api/v1/activity-logs')->assertForbidden();
    $this->deleteJson('/api/v1/activities/'.$id)->assertStatus(405);
    expect(fn () => Activity::find($id)->delete())->toThrow(LogicException::class);
});

test('each linked record is required on reads writes and before history pagination', function () {
    $agent = salesAgent();
    $lead = Lead::factory()->pending()->create();
    $property = Property::factory()->create(['created_by' => $agent->id]);
    $id = $this->actingAs($agent)->postJson('/api/v1/activities', salesInput($lead, ['links' => ['lead:'.$lead->id, 'property:'.$property->id]]))->assertCreated()->json('data.id');
    $restricted = salesAgent(['activity.view', 'activity.edit', 'activity.manage', 'lead.view']);
    $this->actingAs($restricted)->getJson('/api/v1/activities')->assertOk()->assertJsonPath('total', 0);
    $this->getJson('/api/v1/activity-history?subject=lead:'.$lead->id)->assertOk()->assertJsonPath('total', 0);
    $this->getJson('/api/v1/activities/'.$id)->assertForbidden();
    $this->postJson('/api/v1/activities/'.$id, ['_method' => 'PUT', 'version' => 1, 'summary' => 'hidden'])->assertForbidden();
    $restricted->givePermissionTo('activity.create');
    $this->postJson('/api/v1/activities', salesInput($lead, ['links' => ['lead:'.$lead->id, 'property:'.$property->id]]))->assertForbidden();
    expect(Activity::count())->toBe(1);
});

test('completion validates outcomes summaries times and assignment', function () {
    $agent = salesAgent();
    $lead = Lead::factory()->pending()->create();
    $this->actingAs($agent);
    $this->postJson('/api/v1/activities', salesInput($lead, ['summary' => null, 'outcome' => 'attended']))->assertUnprocessable()->assertJsonValidationErrors(['summary', 'outcome']);
    $this->postJson('/api/v1/activities', salesInput($lead, ['assignee_id' => User::factory()->create()->id]))->assertUnprocessable()->assertJsonValidationErrors('assignee_id');
    $this->postJson('/api/v1/activities', salesInput($lead, ['occurred_at' => now()->addDay()->toISOString()]))->assertUnprocessable();
    $this->postJson('/api/v1/activities', salesInput($lead, ['starts_at' => '2026-10-23 10:00:00']))->assertUnprocessable()->assertJsonValidationErrors('starts_at');
    foreach (['meeting', 'viewing'] as $kind) {
        $this->postJson('/api/v1/activities', salesInput($lead, ['kind' => $kind, 'outcome' => 'attended']))->assertCreated();
    }
    foreach (['email', 'message', 'note', 'task'] as $kind) {
        $this->postJson('/api/v1/activities', salesInput($lead, ['kind' => $kind, 'outcome' => null, 'summary' => null]))->assertCreated();
    }
});

test('corrections use versions preserve original and void is final', function () {
    $agent = salesAgent();
    $lead = Lead::factory()->pending()->create();
    $id = $this->actingAs($agent)->postJson('/api/v1/activities', salesInput($lead))->json('data.id');
    $this->postJson('/api/v1/activities/'.$id, ['_method' => 'PUT', 'version' => 1, 'summary' => 'Corrected result'])->assertOk()->assertJsonPath('data.version', 2);
    $this->postJson('/api/v1/activities/'.$id, ['_method' => 'PUT', 'version' => 1, 'summary' => 'Stale'])->assertConflict();
    $this->getJson('/api/v1/activity-history')->assertOk()->assertJsonPath('total', 2)->assertJsonPath('data.0.before.summary', 'Discussed the next viewing.');
    $this->postJson('/api/v1/activities/'.$id, ['_method' => 'PUT', 'version' => 2, 'links' => ['lead:1']])->assertUnprocessable();
    $this->postJson('/api/v1/activities/'.$id, ['_method' => 'PUT', 'version' => 2, 'status' => 'voided'])->assertOk();
    $this->postJson('/api/v1/activities/'.$id, ['_method' => 'PUT', 'version' => 3, 'summary' => 'No'])->assertForbidden();
    expect(fn () => Activity::find($id)->events()->first()->update(['action' => 'changed']))->toThrow(LogicException::class);
});

test('only creator or activity manager may reassign and responsible agents may complete', function () {
    $creator = salesAgent();
    $assignee = salesAgent();
    $other = salesAgent();
    $lead = Lead::factory()->pending()->create();
    $id = $this->actingAs($creator)->postJson('/api/v1/activities', salesInput($lead, ['assignee_id' => $assignee->id]))->json('data.id');
    $this->actingAs($other)->postJson('/api/v1/activities/'.$id, ['_method' => 'PUT', 'version' => 1, 'summary' => 'No'])->assertForbidden();
    $this->actingAs($assignee)->postJson('/api/v1/activities/'.$id, ['_method' => 'PUT', 'version' => 1, 'assignee_id' => $other->id])->assertForbidden();
    $this->postJson('/api/v1/activities/'.$id, ['_method' => 'PUT', 'version' => 1, 'summary' => 'Updated by assignee'])->assertOk();
    $other->givePermissionTo(Permission::findOrCreate('activity.manage', 'web'));
    $this->actingAs($other)->postJson('/api/v1/activities/'.$id, ['_method' => 'PUT', 'version' => 2, 'assignee_id' => $creator->id])->assertOk();
});

test('contact conversion reads original pending work and history without copying', function () {
    $agent = salesAgent();
    $lead = Lead::factory()->pending()->create(['assigned_agent_id' => $agent->id]);
    $this->actingAs($agent)->postJson('/api/v1/activities', salesInput($lead, ['kind' => 'task', 'status' => 'scheduled', 'outcome' => null, 'summary' => null, 'due_date' => today()->toDateString()]))->assertCreated();
    $contact = Contact::factory()->create();
    $this->getJson('/api/v1/activities?subject=contact:'.$contact->id)->assertOk()->assertJsonPath('total', 1);
    $this->getJson('/api/v1/activity-history?subject=contact:'.$contact->id)->assertOk()->assertJsonPath('total', 1);
    expect(Activity::count())->toBe(1);
});

test('date-only overdue and today filters use the activity timezone', function () {
    $this->travelTo(now()->setDate(2026, 10, 23)->setTime(22, 30));
    $agent = salesAgent();
    $lead = Lead::factory()->pending()->create();
    $this->actingAs($agent);
    foreach (['2026-10-23', '2026-10-24', '2026-10-25'] as $date) {
        $this->postJson('/api/v1/activities', salesInput($lead, ['kind' => 'task', 'status' => 'scheduled', 'outcome' => null, 'summary' => null, 'due_date' => $date]))->assertCreated();
    }
    foreach (['overdue', 'today', 'upcoming'] as $bucket) {
        $this->getJson('/api/v1/activities?bucket='.$bucket)->assertOk()->assertJsonPath('total', 1);
    }
});

test('history projection is idempotent recoverable and transactionally isolated', function () {
    Queue::fake();
    $agent = salesAgent();
    $lead = Lead::factory()->pending()->create();
    $activity = app(ActivityService::class)->save($agent, salesInput($lead));
    $event = $activity->events()->first();
    Queue::assertPushed(RecordActivityHistory::class, fn ($job) => $job->eventId === $event->id);
    (new RecordActivityHistory($event->id))->handle();
    (new RecordActivityHistory($event->id))->handle();
    expect(DB::table('activity_history_entries')->count())->toBe(1);
    app(ActivityService::class)->save($agent, salesInput($lead, ['subject' => 'Pending history']));
    $this->artisan('activities:record-pending')->assertSuccessful();
    Queue::assertPushed(RecordActivityHistory::class, fn ($job) => $job->eventId !== $event->id);
    $count = Activity::count();
    try {
        DB::transaction(function () use ($agent, $lead) {
            app(ActivityService::class)->save($agent, salesInput($lead));
            throw new RuntimeException('Rollback');
        });
    } catch (RuntimeException) {
    }
    expect(Activity::count())->toBe($count);
});

test('scheduled work can be cancelled rescheduled completed and filtered', function () {
    $agent = salesAgent();
    $lead = Lead::factory()->pending()->create();
    $this->actingAs($agent);
    $input = salesInput($lead, ['kind' => 'viewing', 'status' => 'scheduled', 'starts_at' => now()->addDay()->toISOString(), 'outcome' => null, 'summary' => null]);
    $id = $this->postJson('/api/v1/activities', $input)->assertCreated()->json('data.id');
    $this->getJson('/api/v1/activities?kind=call')->assertOk()->assertJsonPath('total', 0);
    $this->getJson('/api/v1/activities?assignee_id='.$agent->id.'&kind=viewing&status=scheduled')->assertOk()->assertJsonPath('total', 1);
    $this->postJson('/api/v1/activities/'.$id, ['_method' => 'PUT', 'version' => 1, 'status' => 'cancelled'])->assertOk();
    $this->postJson('/api/v1/activities/'.$id, ['_method' => 'PUT', 'version' => 2, 'status' => 'completed'])->assertUnprocessable();
    $this->postJson('/api/v1/activities/'.$id, ['_method' => 'PUT', 'version' => 2, 'status' => 'scheduled'])->assertOk();
    $this->postJson('/api/v1/activities/'.$id, ['_method' => 'PUT', 'version' => 3, 'status' => 'completed', 'outcome' => 'attended', 'summary' => 'Interested in an offer.'])->assertOk()->assertJsonPath('data.version', 4);
    $this->getJson('/api/v1/activity-history')->assertOk()->assertJsonPath('total', 4)->assertJsonPath('data.0.after.assignee_name', $agent->name);
    $this->getJson('/api/v1/activity-logs')->assertForbidden();
});

test('activity permission rollout grants sales roles without replacing their existing permissions', function () {
    $custom = Permission::findOrCreate('lead.view', 'web');
    $agent = Role::findOrCreate('agent', 'web');
    $manager = Role::findOrCreate('manager', 'web');
    $agent->givePermissionTo($custom);
    $this->seed(ActivityPermissionSeeder::class);
    $this->seed(ActivityPermissionSeeder::class);
    expect($agent->fresh()->permissions->pluck('name')->all())
        ->toContain('lead.view', 'activity.view', 'activity.create', 'activity.edit')
        ->not->toContain('activity.manage', 'activity-log.view');
    expect($manager->fresh()->permissions->pluck('name')->all())->toContain('activity.manage');
});

test('record choices suggest only authorized links and search deals by numeric ID', function () {
    $agent = salesAgent(['activity.view', 'activity.create', 'activity.edit', 'lead.view', 'contact.view', 'property.view', 'deal.view']);
    Lead::factory()->pending()->create(['assigned_agent_id' => $agent->id]);
    $contact = Contact::factory()->create();
    $property = Property::factory()->create(['created_by' => $agent->id, 'status' => PropertyStatus::PENDING]);
    $deal = Deal::factory()->create(['contact_id' => $contact->id, 'property_id' => $property->id]);
    $this->actingAs($agent)->getJson('/api/v1/activities/options?type=deal&search='.$deal->id)->assertOk()
        ->assertJsonCount(1, 'records')->assertJsonPath('records.0.subject', 'deal:'.$deal->id);
    $this->getJson('/api/v1/activities/options?type=deal&search=not-a-deal')->assertOk()->assertJsonCount(0, 'records');
    $this->getJson('/api/v1/activities/options?subject=deal:'.$deal->id)->assertOk()->assertJsonCount(3, 'suggestions');
    $agent->revokePermissionTo('property.view');
    $this->getJson('/api/v1/activities/options?subject=deal:'.$deal->id)->assertOk()->assertJsonCount(2, 'suggestions');
});
