-- Messaging foundation
-- One inbox engine with support and future match-specific conversations.

create table if not exists public.conversations (
    id uuid primary key default gen_random_uuid(),
    type text not null check (type in ('support', 'match')),
    status text not null default 'open'
        check (status in ('open', 'waiting_on_worker', 'waiting_on_employer', 'waiting_on_support', 'closed')),
    worker_profile_id uuid references public.profiles(id) on delete set null,
    employer_profile_id uuid references public.profiles(id) on delete set null,
    agency_profile_id uuid references public.profiles(id) on delete set null,
    offer_id uuid references public.offers(id) on delete set null,
    match_id uuid references public.matches(id) on delete set null,
    created_by_profile_id uuid not null references public.profiles(id) on delete cascade,
    last_message_at timestamptz,
    last_message_by_profile_id uuid references public.profiles(id) on delete set null,
    unlocked_at timestamptz,
    closed_at timestamptz,
    closed_by_profile_id uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.conversation_participants (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    profile_id uuid not null references public.profiles(id) on delete cascade,
    role_in_thread text not null check (role_in_thread in ('worker', 'employer', 'agency', 'support', 'admin')),
    can_write boolean not null default true,
    last_read_at timestamptz,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.conversation_messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    sender_profile_id uuid not null references public.profiles(id) on delete cascade,
    sender_role text not null check (sender_role in ('worker', 'employer', 'agency', 'support', 'admin', 'system')),
    message_type text not null default 'text' check (message_type in ('text', 'system', 'file')),
    body text not null,
    moderation_status text not null default 'clean' check (moderation_status in ('clean', 'blocked', 'flagged')),
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.conversation_flags (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    message_id uuid not null references public.conversation_messages(id) on delete cascade,
    flag_type text not null check (flag_type in ('phone', 'email', 'external_link', 'off_platform_attempt', 'abuse')),
    created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_conversation_participants_unique
    on public.conversation_participants(conversation_id, profile_id);

create index if not exists idx_conversations_worker
    on public.conversations(worker_profile_id, type, status);

create index if not exists idx_conversations_employer
    on public.conversations(employer_profile_id, type, status);

create index if not exists idx_conversations_agency
    on public.conversations(agency_profile_id, type, status);

create index if not exists idx_messages_conversation_created
    on public.conversation_messages(conversation_id, created_at);
