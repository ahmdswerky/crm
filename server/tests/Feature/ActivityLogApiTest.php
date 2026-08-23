<?php

use App\Enums\LeadStatus;
use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Lead;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Support\Carbon;

function grantActivityPermissions(User $user, bool $canRevert = false): void
{
    Permission::findOrCreate('activity-log.view', config('auth.defaults.guard'));
    $user->givePermissionTo('activity-log.view');

    if ($canRevert) {
        Permission::findOrCreate('activity-log.revert', config('auth.defaults.guard'));
        $user->givePermissionTo('activity-log.revert');
    }
}

/** @param array<string, mixed> $parameters */
function activityLogIndexUrl(array $parameters = []): string
{
    if ($parameters === []) {
        return '/api/v1/activity-logs';
    }

    return '/api/v1/activity-logs?'.http_build_query($parameters);
}

function latestActivityFor(Lead $lead, string $event): ActivityLog
{
    return ActivityLog::query()
        ->forSubject($lead)
        ->where('event', $event)
        ->latest('id')
        ->firstOrFail();
}

test('activity-log endpoints require authentication', function () {
    $lead = Lead::factory()->create();
    $activity = latestActivityFor($lead, 'created');

    $this->getJson('/api/v1/activity-logs')->assertUnauthorized();
    $this->getJson("/api/v1/activity-logs/{$activity->id}")->assertUnauthorized();
    $this->postJson("/api/v1/activity-logs/{$activity->id}/revert", [
        'reason' => 'The request has no authenticated user.',
    ])->assertUnauthorized();
});

test('activity-log access requires explicit permissions, including for super-admins', function () {
    $superUser = User::factory()->create(['is_super' => true]);
    $unprivilegedUser = User::factory()->create();
    $revertOnlyUser = User::factory()->create();
    $viewer = User::factory()->create();
    grantActivityPermissions($viewer);

    Permission::findOrCreate('activity-log.revert', config('auth.defaults.guard'));
    $revertOnlyUser->givePermissionTo('activity-log.revert');

    $lead = Lead::factory()->create(['status' => LeadStatus::PENDING]);
    $lead->update(['status' => LeadStatus::QUALIFIED]);
    $activity = latestActivityFor($lead, 'updated');

    foreach ([$superUser, $unprivilegedUser, $revertOnlyUser] as $user) {
        $this->actingAs($user)
            ->getJson('/api/v1/activity-logs')
            ->assertForbidden();

        $this->actingAs($user)
            ->getJson("/api/v1/activity-logs/{$activity->id}")
            ->assertForbidden();

        $this->actingAs($user)
            ->postJson("/api/v1/activity-logs/{$activity->id}/revert", [
                'reason' => 'The user does not have both required permissions.',
            ])
            ->assertForbidden();
    }

    $this->actingAs($viewer)
        ->getJson('/api/v1/activity-logs')
        ->assertOk();

    $this->actingAs($viewer)
        ->getJson("/api/v1/activity-logs/{$activity->id}")
        ->assertOk();

    $this->actingAs($viewer)
        ->postJson("/api/v1/activity-logs/{$activity->id}/revert", [
            'reason' => 'A view-only user cannot revert changes.',
        ])
        ->assertForbidden();
});

test('the unified timeline filters CRM activities by subjects, event, causer, and date', function () {
    $viewer = User::factory()->create();
    $firstCauser = User::factory()->create();
    $secondCauser = User::factory()->create();
    grantActivityPermissions($viewer);

    $firstLead = Lead::factory()->create(['status' => LeadStatus::PENDING]);
    $secondLead = Lead::factory()->create(['status' => LeadStatus::PENDING]);
    $account = Account::factory()->create();

    $this->actingAs($firstCauser);
    $firstLead->update(['status' => LeadStatus::QUALIFIED]);
    $firstUpdate = latestActivityFor($firstLead, 'updated');

    $this->actingAs($secondCauser);
    $secondLead->update(['status' => LeadStatus::CONTACTED]);
    $secondUpdate = latestActivityFor($secondLead, 'updated');

    activity('other')
        ->performedOn($firstLead)
        ->causedBy($firstCauser)
        ->event('updated')
        ->log('must not appear in the CRM timeline');

    $this->actingAs($viewer)
        ->getJson(activityLogIndexUrl([
            'subjects' => ["lead:{$firstLead->id}", "account:{$account->id}"],
        ]))
        ->assertOk()
        ->assertJsonCount(3, 'data')
        ->assertJsonPath('meta.total', 3);

    $filtered = $this->actingAs($viewer)
        ->getJson(activityLogIndexUrl([
            'event' => 'updated',
            'causer_id' => $firstCauser->id,
            'from' => Carbon::yesterday()->toISOString(),
            'to' => Carbon::tomorrow()->toISOString(),
        ]))
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.id', $firstUpdate->id)
        ->assertJsonPath('data.0.causer.id', $firstCauser->id);

    expect($filtered->json('data.0.id'))->not->toBe($secondUpdate->id);

    $this->actingAs($viewer)
        ->getJson(activityLogIndexUrl([
            'from' => Carbon::tomorrow()->toISOString(),
        ]))
        ->assertOk()
        ->assertJsonPath('meta.total', 0);
});

test('the unified timeline uses length-aware pagination and a deterministic newest-first order', function () {
    $viewer = User::factory()->create();
    grantActivityPermissions($viewer);
    $lead = Lead::factory()->create(['status' => LeadStatus::PENDING]);

    $lead->update(['status' => LeadStatus::QUALIFIED]);
    $updatedActivity = latestActivityFor($lead, 'updated');
    $createdActivity = latestActivityFor($lead, 'created');

    $firstPage = $this->actingAs($viewer)
        ->getJson(activityLogIndexUrl([
            'subjects' => ["lead:{$lead->id}"],
            'per_page' => 1,
            'page' => 1,
        ]))
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('meta.current_page', 1)
        ->assertJsonPath('meta.last_page', 2)
        ->assertJsonPath('meta.per_page', 1)
        ->assertJsonPath('meta.total', 2)
        ->assertJsonPath('data.0.id', $updatedActivity->id);

    expect($firstPage->json('links.next'))->not->toBeNull();

    $this->actingAs($viewer)
        ->getJson(activityLogIndexUrl([
            'subjects' => ["lead:{$lead->id}"],
            'per_page' => 1,
            'page' => 2,
        ]))
        ->assertOk()
        ->assertJsonPath('meta.current_page', 2)
        ->assertJsonPath('data.0.id', $createdActivity->id);
});

test('the activity-log index validates filters and pagination input', function () {
    $viewer = User::factory()->create();
    grantActivityPermissions($viewer);

    $this->actingAs($viewer)
        ->getJson(activityLogIndexUrl([
            'subjects' => ['invalid:0'],
            'event' => 'archived',
            'causer_id' => 999999,
            'from' => '2026-07-30T00:00:00Z',
            'to' => '2026-07-29T00:00:00Z',
            'per_page' => 101,
            'page' => 0,
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'subjects.0',
            'event',
            'causer_id',
            'to',
            'per_page',
            'page',
        ]);
});

test('a viewer can inspect the complete activity resource, including before and after values', function () {
    $viewer = User::factory()->create();
    $causer = User::factory()->create();
    grantActivityPermissions($viewer);
    $lead = Lead::factory()->create([
        'name' => 'Before Change',
        'status' => LeadStatus::PENDING,
    ]);

    $this->actingAs($causer);
    $lead->update([
        'name' => 'After Change',
        'status' => LeadStatus::QUALIFIED,
    ]);
    $activity = latestActivityFor($lead, 'updated');

    $this->actingAs($viewer)
        ->getJson("/api/v1/activity-logs/{$activity->id}")
        ->assertOk()
        ->assertJsonStructure([
            'activity_log' => [
                'id',
                'event',
                'description',
                'subject' => ['type', 'id', 'label'],
                'causer' => ['id', 'name'],
                'changes' => ['before', 'after'],
                'metadata' => ['reverted_activity_id', 'reason', 'restored_attributes'],
                'revert' => ['allowed'],
                'created_at',
            ],
        ])
        ->assertJsonPath('activity_log.event', 'updated')
        ->assertJsonPath('activity_log.subject.type', 'lead')
        ->assertJsonPath('activity_log.subject.id', $lead->id)
        ->assertJsonPath('activity_log.subject.label', 'After Change')
        ->assertJsonPath('activity_log.causer.id', $causer->id)
        ->assertJsonPath('activity_log.changes.before.name', 'Before Change')
        ->assertJsonPath('activity_log.changes.after.name', 'After Change')
        ->assertJsonPath('activity_log.revert.allowed', true);
});

test('a viewer can inspect deletion activity with its soft-deleted subject', function () {
    $viewer = User::factory()->create();
    grantActivityPermissions($viewer);
    $lead = Lead::factory()->create(['name' => 'Deleted Lead']);
    $lead->delete();
    $activity = latestActivityFor($lead, 'deleted');

    $this->actingAs($viewer)
        ->getJson("/api/v1/activity-logs/{$activity->id}")
        ->assertOk()
        ->assertJsonPath('activity_log.event', 'deleted')
        ->assertJsonPath('activity_log.subject.label', 'Deleted Lead')
        ->assertJsonPath('activity_log.revert.allowed', true);
});

test('missing activity logs return not found', function () {
    $viewer = User::factory()->create();
    $reverter = User::factory()->create();
    grantActivityPermissions($viewer);
    grantActivityPermissions($reverter, canRevert: true);

    $this->actingAs($viewer)
        ->getJson('/api/v1/activity-logs/999999')
        ->assertNotFound();

    $this->actingAs($reverter)
        ->postJson('/api/v1/activity-logs/999999/revert', [
            'reason' => 'The activity does not exist.',
        ])
        ->assertNotFound();
});

test('a reverter can undo the latest update and the resulting activity records its metadata', function () {
    $user = User::factory()->create();
    grantActivityPermissions($user, canRevert: true);
    $lead = Lead::factory()->create(['status' => LeadStatus::PENDING]);

    $this->actingAs($user);
    $lead->update(['status' => LeadStatus::QUALIFIED]);
    $activity = latestActivityFor($lead, 'updated');

    $this->postJson("/api/v1/activity-logs/{$activity->id}/revert", [
        'reason' => 'Qualification was selected by mistake.',
    ])
        ->assertOk()
        ->assertJsonPath('activity_log.event', 'reverted')
        ->assertJsonPath('activity_log.subject.id', $lead->id)
        ->assertJsonPath('activity_log.metadata.reverted_activity_id', $activity->id)
        ->assertJsonPath('activity_log.metadata.reason', 'Qualification was selected by mistake.')
        ->assertJsonPath('activity_log.metadata.restored_attributes.0', 'status')
        ->assertJsonPath('activity_log.revert.allowed', false);

    expect($lead->fresh()->status)->toBe(LeadStatus::PENDING);

    $this->postJson("/api/v1/activity-logs/{$activity->id}/revert", [
        'reason' => 'Trying to revert a stale event.',
    ])->assertConflict();
});

test('a reverter cannot revert a created activity or submit an invalid reason', function () {
    $user = User::factory()->create();
    grantActivityPermissions($user, canRevert: true);
    $lead = Lead::factory()->create();
    $createdActivity = latestActivityFor($lead, 'created');

    $this->actingAs($user)
        ->postJson("/api/v1/activity-logs/{$createdActivity->id}/revert", [
            'reason' => 'This event type cannot be reverted.',
        ])
        ->assertUnprocessable();

    $this->actingAs($user)
        ->postJson("/api/v1/activity-logs/{$createdActivity->id}/revert", [
            'reason' => 'no',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('reason');
});

test('a reverter can restore the latest soft deletion', function () {
    $user = User::factory()->create();
    grantActivityPermissions($user, canRevert: true);
    $lead = Lead::factory()->create();

    $this->actingAs($user);
    $lead->delete();
    $activity = latestActivityFor($lead, 'deleted');

    $this->postJson("/api/v1/activity-logs/{$activity->id}/revert", [
        'reason' => 'The lead was deleted by mistake.',
    ])
        ->assertOk()
        ->assertJsonPath('activity_log.event', 'reverted')
        ->assertJsonPath('activity_log.metadata.reverted_activity_id', $activity->id)
        ->assertJsonPath('activity_log.metadata.restored_attributes.0', 'deleted_at');

    $this->assertDatabaseHas('leads', [
        'id' => $lead->id,
        'deleted_at' => null,
    ]);
});

test('activity logs have no destructive endpoint and cannot be deleted through Eloquent', function () {
    $viewer = User::factory()->create();
    grantActivityPermissions($viewer);
    $lead = Lead::factory()->create();
    $activity = latestActivityFor($lead, 'created');

    $this->actingAs($viewer)
        ->deleteJson("/api/v1/activity-logs/{$activity->id}")
        ->assertStatus(405);

    expect(fn () => $activity->delete())
        ->toThrow(LogicException::class, 'Activity logs are immutable and cannot be deleted.');

    expect(fn () => $activity->deleteQuietly())
        ->toThrow(LogicException::class, 'Activity logs are immutable and cannot be deleted.');

    expect(fn () => $activity->forceDelete())
        ->toThrow(LogicException::class, 'Activity logs are immutable and cannot be force deleted.');

    expect(fn () => $activity->forceDeleteQuietly())
        ->toThrow(LogicException::class, 'Activity logs are immutable and cannot be force deleted.');

    expect(fn () => ActivityLog::query()->whereKey($activity->id)->delete())
        ->toThrow(LogicException::class, 'Activity logs are immutable and cannot be deleted.');

    expect(fn () => ActivityLog::query()->whereKey($activity->id)->forceDelete())
        ->toThrow(LogicException::class, 'Activity logs are immutable and cannot be force deleted.');
});
