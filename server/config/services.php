<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'rabbitmq' => [
        'host' => env('RABBITMQ_HOST', '127.0.0.1'),
        'port' => (int) env('RABBITMQ_PORT', 5672),
        'user' => env('RABBITMQ_USER', 'crm'),
        'password' => env('RABBITMQ_PASSWORD'),
        'vhost' => env('RABBITMQ_VHOST', '/'),
        'connection_timeout' => (float) env('RABBITMQ_CONNECTION_TIMEOUT', 3),
        'read_write_timeout' => (float) env('RABBITMQ_READ_WRITE_TIMEOUT', 5),
        'heartbeat' => (int) env('RABBITMQ_HEARTBEAT', 30),
        'commands_exchange' => env('RABBITMQ_COMMANDS_EXCHANGE', 'payments.commands'),
        'commands_queue' => env('RABBITMQ_COMMANDS_QUEUE', 'payments'),
        'events_exchange' => env('RABBITMQ_EVENTS_EXCHANGE', 'payments.events'),
        'events_queue' => env('RABBITMQ_EVENTS_QUEUE', 'crm.payment-events'),
    ],

];
