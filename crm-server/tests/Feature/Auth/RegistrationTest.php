<?php

test('registration is not exposed through the API', function () {
    $response = $this->postJson('/api/register');

    $response->assertNotFound();
});
