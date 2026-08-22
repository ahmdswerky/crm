<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;
use RuntimeException;

class UserSeeder extends Seeder
{
    private const AVATAR_DIRECTORY = 'seed-images/avatars';

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $owner = $this->findOrCreateUser('owner@crm.io', [
            'name' => 'Owner',
            'username' => 'owner',
            'is_super' => true,
        ]);
        $this->attachSeedAvatar($owner, '1-male.jpg');

        $developer = $this->findOrCreateUser(config('app.dev_email'), [
            'name' => 'Developer',
            'username' => 'dev',
            'is_super' => true,
        ]);
        $this->attachSeedAvatar($developer, '2-male.jpg');

        $supervisor1 = $this->findOrCreateUser('michael@crm.io', [
            'name' => 'Michael Smith',
            'username' => 'michael',
        ]);
        $this->attachSeedAvatar($supervisor1, '3-male.jpg');

        $supervisor2 = $this->findOrCreateUser('chris@crm.io', [
            'name' => 'Chris Anderson',
            'username' => 'chris',
        ]);
        $this->attachSeedAvatar($supervisor2, '1-male.jpg');

        $jack = $this->findOrCreateUser('j.ryan.agent@crm.io', [
            'name' => 'Jack Ryan',
            'username' => 'j.ryan',
            'direct_manager_id' => $supervisor1->id,
        ]);
        $this->attachSeedAvatar($jack, '2-male.jpg');

        $maya = $this->findOrCreateUser('m.hassan.agent@crm.io', [
            'name' => 'Maya Hassan',
            'username' => 'm.hassan',
            'direct_manager_id' => $supervisor1->id,
        ]);
        $this->attachSeedAvatar($maya, '1-female.jpg');

        $omar = $this->findOrCreateUser('o.khalil.agent@crm.io', [
            'name' => 'Omar Khalil',
            'username' => 'o.khalil',
            'direct_manager_id' => $supervisor1->id,
        ]);
        $this->attachSeedAvatar($omar, '3-male.jpg');

        $lina = $this->findOrCreateUser('l.adel.agent@crm.io', [
            'name' => 'Lina Adel',
            'username' => 'l.adel',
            'direct_manager_id' => $supervisor2->id,
        ]);
        $this->attachSeedAvatar($lina, '2-female.jpg');

        $karim = $this->findOrCreateUser('k.nassar.agent@crm.io', [
            'name' => 'Karim Nassar',
            'username' => 'k.nassar',
            'direct_manager_id' => $supervisor2->id,
        ]);
        $this->attachSeedAvatar($karim, '1-male.jpg');

        $nour = $this->findOrCreateUser('n.samir.agent@crm.io', [
            'name' => 'Nour Samir',
            'username' => 'n.samir',
            'direct_manager_id' => $supervisor2->id,
        ]);
        $this->attachSeedAvatar($nour, '3-female.jpg');
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function findOrCreateUser(string $email, array $attributes): User
    {
        $user = User::query()->where('email', $email)->first();

        return $user ?? User::factory()->create([
            ...$attributes,
            'email' => $email,
        ]);
    }

    private function attachSeedAvatar(User $user, string $filename): void
    {
        if ($user->getFirstMedia('main')) {
            return;
        }

        $path = public_path(self::AVATAR_DIRECTORY.'/'.$filename);

        if (! File::isFile($path)) {
            throw new RuntimeException("The seed avatar is missing: {$path}");
        }

        $user
            ->addMedia($path)
            ->preservingOriginal()
            ->toMediaCollection('main');
    }
}
