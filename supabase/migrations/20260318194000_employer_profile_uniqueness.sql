begin;

with ranked_employers as (
    select
        e.id,
        e.profile_id,
        row_number() over (
            partition by e.profile_id
            order by
                (
                    (case when coalesce(e.admin_approved, false) then 400 else 0 end) +
                    (case when nullif(trim(coalesce(e.contact_phone, '')), '') is not null then 60 else 0 end) +
                    (case when nullif(trim(coalesce(e.contact_email, '')), '') is not null then 40 else 0 end) +
                    (case when nullif(trim(coalesce(e.country, '')), '') is not null then 20 else 0 end) +
                    (case when nullif(trim(coalesce(e.industry, '')), '') is not null then 20 else 0 end) +
                    (case when nullif(trim(coalesce(e.company_registration_number, '')), '') is not null then 20 else 0 end) +
                    (case when nullif(trim(coalesce(e.company_address, '')), '') is not null then 18 else 0 end) +
                    (case when nullif(trim(coalesce(e.city, '')), '') is not null then 10 else 0 end) +
                    (case when nullif(trim(coalesce(e.postal_code, '')), '') is not null then 8 else 0 end) +
                    (case when nullif(trim(coalesce(e.business_registry_number, '')), '') is not null then 18 else 0 end) +
                    (case when nullif(trim(coalesce(e.website, '')), '') is not null then 10 else 0 end) +
                    (case when nullif(trim(coalesce(e.description, '')), '') is not null then 10 else 0 end) +
                    (case when nullif(trim(coalesce(e.status, '')), '') is not null and upper(e.status) <> 'PENDING' then 80 else 0 end) +
                    (case when nullif(trim(coalesce(e.company_name, '')), '') is not null then 5 else 0 end)
                ) desc,
                coalesce(e.updated_at, e.created_at, timezone('utc', now())) desc,
                e.id desc
        ) as row_rank
    from public.employers e
    where e.profile_id is not null
),
duplicate_employers as (
    select
        drop_row.profile_id,
        keep_row.id as keep_id,
        drop_row.id as drop_id
    from ranked_employers drop_row
    join ranked_employers keep_row
        on keep_row.profile_id = drop_row.profile_id
       and keep_row.row_rank = 1
    where drop_row.row_rank > 1
)
update public.job_requests as job_requests
set employer_id = duplicate_employers.keep_id
from duplicate_employers
where job_requests.employer_id = duplicate_employers.drop_id
  and job_requests.employer_id is distinct from duplicate_employers.keep_id;

with ranked_employers as (
    select
        e.id,
        e.profile_id,
        row_number() over (
            partition by e.profile_id
            order by
                (
                    (case when coalesce(e.admin_approved, false) then 400 else 0 end) +
                    (case when nullif(trim(coalesce(e.contact_phone, '')), '') is not null then 60 else 0 end) +
                    (case when nullif(trim(coalesce(e.contact_email, '')), '') is not null then 40 else 0 end) +
                    (case when nullif(trim(coalesce(e.country, '')), '') is not null then 20 else 0 end) +
                    (case when nullif(trim(coalesce(e.industry, '')), '') is not null then 20 else 0 end) +
                    (case when nullif(trim(coalesce(e.company_registration_number, '')), '') is not null then 20 else 0 end) +
                    (case when nullif(trim(coalesce(e.company_address, '')), '') is not null then 18 else 0 end) +
                    (case when nullif(trim(coalesce(e.city, '')), '') is not null then 10 else 0 end) +
                    (case when nullif(trim(coalesce(e.postal_code, '')), '') is not null then 8 else 0 end) +
                    (case when nullif(trim(coalesce(e.business_registry_number, '')), '') is not null then 18 else 0 end) +
                    (case when nullif(trim(coalesce(e.website, '')), '') is not null then 10 else 0 end) +
                    (case when nullif(trim(coalesce(e.description, '')), '') is not null then 10 else 0 end) +
                    (case when nullif(trim(coalesce(e.status, '')), '') is not null and upper(e.status) <> 'PENDING' then 80 else 0 end) +
                    (case when nullif(trim(coalesce(e.company_name, '')), '') is not null then 5 else 0 end)
                ) desc,
                coalesce(e.updated_at, e.created_at, timezone('utc', now())) desc,
                e.id desc
        ) as row_rank
    from public.employers e
    where e.profile_id is not null
),
duplicate_employers as (
    select
        drop_row.profile_id,
        keep_row.id as keep_id,
        drop_row.id as drop_id
    from ranked_employers drop_row
    join ranked_employers keep_row
        on keep_row.profile_id = drop_row.profile_id
       and keep_row.row_rank = 1
    where drop_row.row_rank > 1
)
update public.matches as matches
set employer_id = duplicate_employers.keep_id
from duplicate_employers
where matches.employer_id = duplicate_employers.drop_id
  and matches.employer_id is distinct from duplicate_employers.keep_id;

with ranked_employers as (
    select
        e.id,
        e.profile_id,
        row_number() over (
            partition by e.profile_id
            order by
                (
                    (case when coalesce(e.admin_approved, false) then 400 else 0 end) +
                    (case when nullif(trim(coalesce(e.contact_phone, '')), '') is not null then 60 else 0 end) +
                    (case when nullif(trim(coalesce(e.contact_email, '')), '') is not null then 40 else 0 end) +
                    (case when nullif(trim(coalesce(e.country, '')), '') is not null then 20 else 0 end) +
                    (case when nullif(trim(coalesce(e.industry, '')), '') is not null then 20 else 0 end) +
                    (case when nullif(trim(coalesce(e.company_registration_number, '')), '') is not null then 20 else 0 end) +
                    (case when nullif(trim(coalesce(e.company_address, '')), '') is not null then 18 else 0 end) +
                    (case when nullif(trim(coalesce(e.city, '')), '') is not null then 10 else 0 end) +
                    (case when nullif(trim(coalesce(e.postal_code, '')), '') is not null then 8 else 0 end) +
                    (case when nullif(trim(coalesce(e.business_registry_number, '')), '') is not null then 18 else 0 end) +
                    (case when nullif(trim(coalesce(e.website, '')), '') is not null then 10 else 0 end) +
                    (case when nullif(trim(coalesce(e.description, '')), '') is not null then 10 else 0 end) +
                    (case when nullif(trim(coalesce(e.status, '')), '') is not null and upper(e.status) <> 'PENDING' then 80 else 0 end) +
                    (case when nullif(trim(coalesce(e.company_name, '')), '') is not null then 5 else 0 end)
                ) desc,
                coalesce(e.updated_at, e.created_at, timezone('utc', now())) desc,
                e.id desc
        ) as row_rank
    from public.employers e
    where e.profile_id is not null
),
duplicate_employers as (
    select id as drop_id
    from ranked_employers
    where row_rank > 1
)
delete from public.employers e
using duplicate_employers
where e.id = duplicate_employers.drop_id;

create unique index if not exists employers_profile_id_unique_idx
    on public.employers(profile_id)
    where profile_id is not null;

commit;
