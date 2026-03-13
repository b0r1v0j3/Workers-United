create table if not exists public.admin_test_agency_worker_documents (
    id uuid primary key default gen_random_uuid(),
    persona_id uuid not null references public.admin_test_personas(id) on delete cascade,
    agency_worker_id uuid not null references public.admin_test_agency_workers(id) on delete cascade,
    document_type text not null check (document_type in ('passport', 'biometric_photo', 'diploma')),
    file_name text,
    storage_path text,
    mime_type text,
    status text not null default 'uploaded',
    reject_reason text,
    verification_data jsonb,
    verified_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists admin_test_agency_worker_documents_worker_doc_idx
    on public.admin_test_agency_worker_documents(agency_worker_id, document_type);

create index if not exists admin_test_agency_worker_documents_persona_idx
    on public.admin_test_agency_worker_documents(persona_id, agency_worker_id, created_at desc);

alter table public.admin_test_agency_worker_documents enable row level security;
