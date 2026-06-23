<?php

namespace App\Http\Controllers;

use App\Contracts\Repositories\ContactRepositoryInterface;
use App\Http\Requests\Contact\ContactStoreRequest;
use App\Http\Requests\Contact\ContactUpdateRequest;
use App\Http\Resources\ContactResource;
use App\Models\Contact;
use Illuminate\Routing\Attributes\Controllers\Authorize;

class ContactController extends Controller
{
    public function __construct(protected ContactRepositoryInterface $contactRepository) {}

    #[Authorize('viewAny', Contact::class)]
    public function index()
    {
        $data = $this->contactRepository->paginate();

        return ContactResource::collection($data);
    }

    #[Authorize('create', Contact::class)]
    public function store(ContactStoreRequest $request)
    {
        $contact = $this->contactRepository->store($request->validated());

        return response()->json([
            'contact' => ContactResource::make($contact),
        ], 201);
    }

    #[Authorize('view', 'contact')]
    public function show(Contact $contact)
    {
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
