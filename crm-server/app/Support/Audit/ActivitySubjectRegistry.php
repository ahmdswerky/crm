<?php

namespace App\Support\Audit;

use App\Models\Account;
use App\Models\Contact;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Property;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

class ActivitySubjectRegistry
{
    /** @var array<string, class-string<Model>> */
    protected const MODELS = [
        'account' => Account::class,
        'contact' => Contact::class,
        'deal' => Deal::class,
        'lead' => Lead::class,
        'property' => Property::class,
        'user' => User::class,
    ];

    /** @return array{type: string, model: class-string<Model>, id: int} */
    public function parse(string $subject): array
    {
        [$type, $id] = array_pad(explode(':', $subject, 2), 2, null);

        if (! isset(self::MODELS[$type]) || filter_var($id, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false) {
            throw new InvalidArgumentException('Each subject must use the type:id format.');
        }

        return [
            'type' => $type,
            'model' => self::MODELS[$type],
            'id' => (int) $id,
        ];
    }

    public function modelForMorphType(string $morphType): string
    {
        foreach (self::MODELS as $model) {
            if ((new $model)->getMorphClass() === $morphType) {
                return $model;
            }
        }

        throw new InvalidArgumentException('The activity subject is not a CRM model.');
    }

    public function typeForMorphType(?string $morphType): ?string
    {
        if ($morphType === null) {
            return null;
        }

        foreach (self::MODELS as $type => $model) {
            if ((new $model)->getMorphClass() === $morphType) {
                return $type;
            }
        }

        return null;
    }

    public function labelFor(?Model $subject): ?string
    {
        if ($subject === null) {
            return null;
        }

        foreach (['name', 'title', 'username', 'email'] as $attribute) {
            if (filled($subject->getAttribute($attribute))) {
                return (string) $subject->getAttribute($attribute);
            }
        }

        return sprintf('%s #%s', str($subject->getTable())->singular(), $subject->getKey());
    }
}
