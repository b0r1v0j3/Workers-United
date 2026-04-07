begin;

create table if not exists public.admin_whatsapp_thread_views (
    admin_profile_id uuid not null references public.profiles (id) on delete cascade,
    phone_number text not null,
    last_seen_at timestamptz not null default timezone('utc', now()),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    primary key (admin_profile_id, phone_number)
);

create index if not exists idx_admin_whatsapp_thread_views_phone
    on public.admin_whatsapp_thread_views (phone_number, last_seen_at desc);

commit;
