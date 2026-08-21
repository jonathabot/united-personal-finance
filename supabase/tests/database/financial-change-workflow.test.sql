begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '40000000-0000-0000-0000-000000000004',
  'authenticated', 'authenticated', 'carla@example.test', '',
  now(), '{}'::jsonb, '{}'::jsonb, now(), now()
);

set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000004';

insert into public.pending_financial_changes (
  id, user_id, client_thread_id, action, payload
) values (
  '50000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000004',
  '60000000-0000-0000-0000-000000000006',
  'create_entity',
  jsonb_build_object(
    'kind', 'account',
    'name', 'Conta principal',
    'normalizedName', 'conta principal',
    'effectiveFrom', '2026-08-01'
  )
);

select lives_ok(
  $$select public.confirm_financial_change('50000000-0000-0000-0000-000000000005')$$,
  'A pending entity draft can be confirmed'
);

select lives_ok(
  $$select public.confirm_financial_change('50000000-0000-0000-0000-000000000005')$$,
  'Confirming the same draft twice is idempotent'
);

select results_eq(
  $$select count(*) from public.financial_entities where normalized_name = 'conta principal'$$,
  array[1::bigint],
  'Idempotent confirmation creates one financial entity'
);

select results_eq(
  $$select status from public.pending_financial_changes
    where id = '50000000-0000-0000-0000-000000000005'$$,
  array['confirmed'::text],
  'Confirmed draft stores its terminal status'
);

select results_eq(
  $$select count(*) from public.audit_log
    where user_id = '40000000-0000-0000-0000-000000000004'
      and table_name = 'financial_entities'
      and operation = 'INSERT'$$,
  array[1::bigint],
  'Confirmation automatically creates one audit entry'
);

insert into public.pending_financial_changes (
  id, user_id, client_thread_id, action, payload, expires_at
) values (
  '70000000-0000-0000-0000-000000000007',
  '40000000-0000-0000-0000-000000000004',
  '80000000-0000-0000-0000-000000000008',
  'create_entity',
  jsonb_build_object(
    'kind', 'reserve',
    'name', 'Reserva expirada',
    'normalizedName', 'reserva expirada',
    'effectiveFrom', '2026-08-01'
  ),
  now() - interval '1 minute'
);

select results_eq(
  $$select public.confirm_financial_change('70000000-0000-0000-0000-000000000007') ->> 'status'$$,
  array['expired'::text],
  'An expired draft returns its terminal status instead of being confirmed'
);

select results_eq(
  $$select status from public.pending_financial_changes
    where id = '70000000-0000-0000-0000-000000000007'$$,
  array['expired'::text],
  'Rejected expired draft stores its terminal status'
);

select * from finish();
rollback;
