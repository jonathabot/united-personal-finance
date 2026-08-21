begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'alice@example.test', '',
    now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'bruno@example.test', '',
    now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.financial_entities (user_id, kind, name, normalized_name)
values
  ('10000000-0000-0000-0000-000000000001', 'account', 'Conta Alice', 'conta alice'),
  ('20000000-0000-0000-0000-000000000002', 'account', 'Conta Bruno', 'conta bruno');

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select results_eq(
  $$select count(*) from public.financial_entities$$,
  array[1::bigint],
  'Alice can only read her own financial entity'
);

select lives_ok(
  $$insert into public.financial_entities (user_id, kind, name, normalized_name)
    values ('10000000-0000-0000-0000-000000000001', 'reserve', 'Reserva Alice', 'reserva alice')$$,
  'Alice can insert her own financial entity'
);

select throws_ok(
  $$insert into public.financial_entities (user_id, kind, name, normalized_name)
    values ('20000000-0000-0000-0000-000000000002', 'reserve', 'Reserva indevida', 'reserva indevida')$$,
  '42501',
  'new row violates row-level security policy for table "financial_entities"',
  'Alice cannot insert a financial entity for Bruno'
);

select throws_ok(
  $$insert into public.audit_log (user_id, table_name, record_id, operation)
    values (
      '10000000-0000-0000-0000-000000000001',
      'financial_entities',
      '30000000-0000-0000-0000-000000000003',
      'INSERT'
    )$$,
  '42501',
  'permission denied for table audit_log',
  'Authenticated users cannot write directly to the audit log'
);

set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000002';

select results_eq(
  $$select count(*) from public.financial_entities$$,
  array[1::bigint],
  'Bruno can only read his own financial entity'
);

select * from finish();
rollback;
