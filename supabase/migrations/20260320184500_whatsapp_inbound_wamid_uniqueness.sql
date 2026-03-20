begin;

with ranked as (
    select
        id,
        row_number() over (
            partition by wamid
            order by created_at asc nulls last, id asc
        ) as row_rank
    from public.whatsapp_messages
    where direction = 'inbound'
      and wamid is not null
)
delete from public.whatsapp_messages messages
using ranked
where messages.id = ranked.id
  and ranked.row_rank > 1;

drop index if exists public.idx_whatsapp_wamid;

create unique index if not exists idx_whatsapp_inbound_wamid_unique
    on public.whatsapp_messages (wamid)
    where direction = 'inbound' and wamid is not null;

commit;
