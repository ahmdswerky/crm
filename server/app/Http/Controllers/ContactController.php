<?php

namespace App\Http\Controllers;

use App\Contracts\Repositories\ContactRepositoryInterface;
use App\Http\Requests\Contact\ContactIndexRequest;
use App\Http\Requests\Contact\ContactStoreRequest;
use App\Http\Requests\Contact\ContactUpdateRequest;
use App\Http\Resources\ContactResource;
use App\Models\Contact;
use App\Services\ContactService;
use Illuminate\Routing\Attributes\Controllers\Authorize;

class ContactController extends Controller
{
    public function __construct(
        protected ContactService $contactService,
        protected ContactRepositoryInterface $contactRepository,
    ) {}

    #[Authorize('viewAny', Contact::class)]
    public function index(ContactIndexRequest $request)
    {
        $data = $this->contactRepository->paginate($request->validated());

        return ContactResource::collection($data);
    }

    #[Authorize('create', Contact::class)]
    public function store(ContactStoreRequest $request)
    {
        $contact = $this->contactService->store(
            $request->input('lead_id'),
            $request->only(['title', 'phone', 'account_id']),
        );

        return response()->json([
            'contact' => ContactResource::make($contact),
        ], 201);
    }

    #[Authorize('view', 'contact')]
    public function show(Contact $contact)
    {
        $contact->load('account', 'lead');

        return response()->json([
            'contact' => ContactResource::make($contact),
        ]);
    }

    #[Authorize('update', 'contact')]
    public function update(ContactUpdateRequest $request, Contact $contact)
    {
        $contact = $this->contactRepository->update($contact, $request->validated());

        return response()->json([
            'contact' => ContactResource::make($contact),
        ]);
    }

    #[Authorize('delete', 'contact')]
    public function destroy(Contact $contact)
    {
        $this->contactRepository->delete($contact->id);

        return response()->json([], 204);
    }
}
