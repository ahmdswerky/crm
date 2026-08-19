<?php

namespace Database\Seeders;

use App\Models\Account;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;
use RuntimeException;

class AccountSeeder extends Seeder
{
    public function run(): void
    {
        $companies = [
            'Nike' => 'nike.svg',
            'IKEA' => 'ikea.svg',
            'Apple' => 'apple.svg',
            'Google' => 'google.svg',
            'Uber' => 'uber.svg',
        ];

        collect($companies)
            ->each(function (string $image, string $company): void {
                $path = public_path("seed-images/companies/{$image}");

                if (! File::exists($path)) {
                    throw new RuntimeException("The seed image for {$company} is missing.");
                }

                $account = Account::factory()
                    ->create([
                        'name' => $company,
                    ]);

                $account
                    ->addMedia($path)
                    ->preservingOriginal()
                    ->toMediaCollection('main');
            });
    }
}
