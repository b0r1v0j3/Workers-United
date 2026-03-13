-- ============================================================================
-- Admin sandbox personas
-- Keeps admin QA/test flows completely separate from live worker/employer/agency
-- records so mobile testing never pollutes official funnel, payments, or docs.
-- ============================================================================

create table if not exists public.admin_test_personas (
    id uuid primary key default gen_random_uuid(),
    owner_profile_id uuid not null references public.profiles(id) on delete cascade,
    role text not null check (role in ('worker', 'employer', 'agency')),
    label text not null,
    description text,
    status text not null default 'active',
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    last_used_at timestamptz
);

create unique index if not exists admin_test_personas_owner_role_idx
    on public.admin_test_personas(owner_profile_id, role);

create table if not exists public.admin_test_worker_profiles (
    persona_id uuid primary key references public.admin_test_personas(id) on delete cascade,
    full_name text,
    email text,
    phone text,
    nationality text,
    current_country text,
    preferred_job text,
    desired_countries jsonb,
    date_of_birth date,
    birth_country text,
    birth_city text,
    citizenship text,
    original_citizenship text,
    maiden_name text,
    father_name text,
    mother_name text,
    marital_status text,
    gender text,
    address text,
    family_data jsonb,
    passport_number text,
    passport_issued_by text,
    passport_issue_date date,
    passport_expiry_date date,
    lives_abroad text,
    previous_visas text,
    status text default 'NEW',
    entry_fee_paid boolean not null default false,
    job_search_active boolean not null default false,
    queue_joined_at timestamptz,
    job_search_activated_at timestamptz,
    queue_position integer,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_test_worker_documents (
    id uuid primary key default gen_random_uuid(),
    persona_id uuid not null references public.admin_test_personas(id) on delete cascade,
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

create unique index if not exists admin_test_worker_documents_persona_doc_idx
    on public.admin_test_worker_documents(persona_id, document_type);

create table if not exists public.admin_test_employers (
    persona_id uuid primary key references public.admin_test_personas(id) on delete cascade,
    company_name text,
    tax_id text,
    company_registration_number text,
    company_address text,
    contact_phone text,
    contact_email text,
    status text default 'PENDING',
    website text,
    industry text,
    company_size text,
    founded_year text,
    description text,
    country text,
    city text,
    postal_code text,
    business_registry_number text,
    founding_date date,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_test_job_requests (
    id uuid primary key default gen_random_uuid(),
    persona_id uuid not null references public.admin_test_personas(id) on delete cascade,
    title text not null,
    description text,
    industry text,
    positions_count integer not null default 1,
    positions_filled integer not null default 0,
    work_city text,
    salary_rsd numeric,
    accommodation_address text,
    work_schedule text,
    contract_duration_months integer,
    experience_required_years integer,
    destination_country text,
    status text not null default 'open',
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_test_job_requests_persona_idx
    on public.admin_test_job_requests(persona_id, created_at desc);

create table if not exists public.admin_test_agencies (
    persona_id uuid primary key references public.admin_test_personas(id) on delete cascade,
    display_name text,
    legal_name text,
    contact_email text,
    contact_phone text,
    country text,
    city text,
    website_url text,
    status text default 'active',
    notes text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_test_agency_workers (
    id uuid primary key default gen_random_uuid(),
    persona_id uuid not null references public.admin_test_personas(id) on delete cascade,
    full_name text,
    email text,
    phone text,
    nationality text,
    current_country text,
    preferred_job text,
    desired_countries jsonb,
    gender text,
    marital_status text,
    date_of_birth date,
    birth_country text,
    birth_city text,
    citizenship text,
    original_citizenship text,
    maiden_name text,
    father_name text,
    mother_name text,
    address text,
    family_data jsonb,
    passport_number text,
    passport_issued_by text,
    passport_issue_date date,
    passport_expiry_date date,
    lives_abroad text,
    previous_visas text,
    status text default 'NEW',
    entry_fee_paid boolean not null default false,
    job_search_active boolean not null default false,
    queue_joined_at timestamptz,
    queue_position integer,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_test_agency_workers_persona_idx
    on public.admin_test_agency_workers(persona_id, created_at desc);

alter table public.admin_test_personas enable row level security;
alter table public.admin_test_worker_profiles enable row level security;
alter table public.admin_test_worker_documents enable row level security;
alter table public.admin_test_employers enable row level security;
alter table public.admin_test_job_requests enable row level security;
alter table public.admin_test_agencies enable row level security;
alter table public.admin_test_agency_workers enable row level security;
