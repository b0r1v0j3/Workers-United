begin;

create index if not exists idx_whatsapp_messages_normalized_phone_created_at
    on public.whatsapp_messages (
        (
            case
                when regexp_replace(coalesce(phone_number, ''), '\D', '', 'g') <> ''
                    then '+' || regexp_replace(phone_number, '\D', '', 'g')
                else ''
            end
        ),
        created_at desc
    );

create or replace view public.admin_whatsapp_message_log as
select
    messages.id,
    messages.user_id,
    case
        when regexp_replace(coalesce(messages.phone_number, ''), '\D', '', 'g') <> ''
            then '+' || regexp_replace(messages.phone_number, '\D', '', 'g')
        else ''
    end as normalized_phone_number,
    messages.phone_number as raw_phone_number,
    messages.direction,
    messages.content,
    messages.created_at,
    messages.status,
    messages.message_type,
    messages.template_name,
    messages.error_message,
    coalesce(
        nullif(btrim(messages.content), ''),
        case
            when messages.template_name is not null then 'Template: ' || messages.template_name
            when messages.message_type is not null then '[' || messages.message_type || ']'
            else '(no content)'
        end
    ) as preview
from public.whatsapp_messages messages
where coalesce(messages.phone_number, '') <> '';

create or replace view public.admin_whatsapp_thread_summaries as
with latest_message as (
    select distinct on (normalized_phone_number)
        normalized_phone_number,
        created_at as latest_at,
        direction as latest_direction,
        status as latest_status,
        preview as latest_preview,
        template_name as latest_template_name,
        message_type as latest_message_type,
        id
    from public.admin_whatsapp_message_log
    where normalized_phone_number <> ''
    order by normalized_phone_number, created_at desc nulls last, id desc
),
thread_aggregate as (
    select
        normalized_phone_number,
        count(*)::bigint as message_count,
        count(*) filter (where direction = 'inbound')::bigint as inbound_count,
        count(*) filter (where direction = 'outbound')::bigint as outbound_count,
        count(*) filter (where status = 'failed')::bigint as failed_count,
        count(*) filter (where template_name is not null or message_type = 'template')::bigint as template_count,
        bool_or(user_id is null) as has_unlinked_messages,
        array_remove(array_agg(distinct user_id), null)::uuid[] as linked_profile_ids
    from public.admin_whatsapp_message_log
    where normalized_phone_number <> ''
    group by normalized_phone_number
)
select
    aggregate.normalized_phone_number as phone_number,
    latest.latest_at,
    latest.latest_direction,
    latest.latest_status,
    latest.latest_preview,
    latest.latest_template_name,
    latest.latest_message_type,
    aggregate.message_count,
    aggregate.inbound_count,
    aggregate.outbound_count,
    aggregate.failed_count,
    aggregate.template_count,
    aggregate.has_unlinked_messages,
    aggregate.linked_profile_ids
from thread_aggregate aggregate
join latest_message latest
    on latest.normalized_phone_number = aggregate.normalized_phone_number;

commit;
