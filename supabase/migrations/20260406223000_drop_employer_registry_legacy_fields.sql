begin;

alter table if exists public.contract_data
    drop column if exists employer_apr_number;

alter table if exists public.employers
    drop column if exists business_registry_number;

alter table if exists public.admin_test_employers
    drop column if exists business_registry_number;

commit;
