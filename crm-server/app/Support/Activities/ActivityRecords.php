<?php

namespace App\Support\Activities;

use App\Models\Contact;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Property;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class ActivityRecords
{
    public const MODELS = ['lead' => Lead::class, 'contact' => Contact::class, 'deal' => Deal::class, 'property' => Property::class];

    public function resolve(string $subject, bool $archived = true): Model
    {
        if (! preg_match('/^(lead|contact|deal|property):([1-9][0-9]*)$/D', $subject, $match)) {
            throw ValidationException::withMessages(['subject' => __('Use lead, contact, deal or property followed by :id.')]);
        }
        $model = self::MODELS[$match[1]];

        return ($archived ? $model::withTrashed() : $model::query())->findOrFail((int) $match[2]);
    }

    public function subjects(string $subject, User $user): array
    {
        $record = $this->resolve($subject);
        Gate::forUser($user)->authorize('view', $record);
        $subjects = [$subject];
        if ($record instanceof Contact && $record->lead_id) {
            $lead = Lead::withTrashed()->find($record->lead_id);
            if ($lead && Gate::forUser($user)->allows('view', $lead)) {
                $subjects[] = 'lead:'.$lead->id;
            }
        }

        return $subjects;
    }

    public function label(Model $record): string
    {
        return (string) ($record->name ?? $record->title ?? class_basename($record).' #'.$record->getKey());
    }
}
