<?php

namespace App\Support\Audit;

use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

trait LogsCrmActivity
{
    use LogsActivity;

    protected function auditAttributes(): ?array
    {
        return null;
    }

    public function getActivitylogOptions(): LogOptions
    {
        $options = LogOptions::defaults()
            ->useLogName('crm')
            ->logOnlyDirty()
            ->dontLogEmptyChanges()
            ->dontLogIfAttributesChangedOnly(['updated_at'])
            ->setDescriptionForEvent(
                fn (string $event) => sprintf('%s %s', $event, str($this->getTable())->singular())
            );

        $attributes = $this->auditAttributes();

        if ($attributes !== null) {
            return $options->logOnly($attributes);
        }

        return $options->logFillable();
    }
}
