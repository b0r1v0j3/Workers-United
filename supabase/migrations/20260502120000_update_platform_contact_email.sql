begin;

insert into public.platform_config (key, value, description)
values ('contact_email', 'workers.united.eu@gmail.com', 'Contact email')
on conflict (key)
do update set
    value = excluded.value,
    description = excluded.description,
    updated_at = now();

commit;
