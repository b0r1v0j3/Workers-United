alter table public.admin_test_agency_workers
    add column if not exists admin_approved boolean not null default false;
