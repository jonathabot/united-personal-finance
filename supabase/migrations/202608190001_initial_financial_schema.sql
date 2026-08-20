begin;

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financial_entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income', 'credit_card', 'fixed_expense', 'loan', 'reserve', 'account')),
  name text not null check (length(trim(name)) between 1 and 120),
  normalized_name text not null check (length(trim(normalized_name)) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'inactive', 'settled', 'archived')),
  closing_day smallint check (closing_day between 1 and 31),
  due_day smallint check (due_day between 1 and 31),
  active_from date not null default current_date,
  active_until date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_name),
  unique (id, user_id),
  check (active_until is null or active_until >= active_from),
  check (kind = 'credit_card' or closing_day is null),
  check (kind in ('credit_card', 'fixed_expense', 'loan') or due_day is null)
);

create table public.financial_entity_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_id uuid not null,
  alias text not null check (length(trim(alias)) between 1 and 120),
  normalized_alias text not null check (length(trim(normalized_alias)) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (user_id, normalized_alias),
  foreign key (entity_id, user_id) references public.financial_entities(id, user_id) on delete cascade
);

create table public.recurring_values (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_id uuid not null,
  amount_cents bigint not null check (amount_cents >= 0),
  effective_from date not null check (effective_from = date_trunc('month', effective_from)::date),
  effective_until date check (effective_until is null or effective_until = date_trunc('month', effective_until)::date),
  created_at timestamptz not null default now(),
  check (effective_until is null or effective_until >= effective_from),
  unique (entity_id, effective_from),
  foreign key (entity_id, user_id) references public.financial_entities(id, user_id) on delete cascade
);

create table public.monthly_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_id uuid not null,
  month date not null check (month = date_trunc('month', month)::date),
  amount_cents bigint not null check (amount_cents >= 0),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_id, month),
  foreign key (entity_id, user_id) references public.financial_entities(id, user_id) on delete cascade
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_id uuid,
  type text not null check (type in ('expense', 'income', 'refund', 'transfer')),
  amount_cents bigint not null check (amount_cents > 0),
  occurred_on date not null,
  description text not null check (length(trim(description)) between 1 and 300),
  category text not null check (length(trim(category)) between 1 and 120),
  belongs_to_third_party boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'voided')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (entity_id, user_id) references public.financial_entities(id, user_id) on delete restrict
);

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null,
  entity_id uuid not null,
  installment_number integer not null check (installment_number > 0),
  installment_count integer not null check (installment_count > 0),
  statement_month date not null check (statement_month = date_trunc('month', statement_month)::date),
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'paid', 'anticipated', 'voided')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (transaction_id, installment_number),
  check (installment_number <= installment_count),
  foreign key (transaction_id, user_id) references public.transactions(id, user_id) on delete cascade,
  foreign key (entity_id, user_id) references public.financial_entities(id, user_id) on delete restrict
);

create table public.debt_settlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_id uuid not null,
  settled_on date not null,
  nominal_cents bigint not null check (nominal_cents >= 0),
  paid_cents bigint not null check (paid_cents >= nominal_cents),
  note text,
  created_at timestamptz not null default now(),
  foreign key (entity_id, user_id) references public.financial_entities(id, user_id) on delete restrict
);

create table public.conversation_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null,
  ui_payload jsonb,
  created_at timestamptz not null default now(),
  foreign key (thread_id, user_id) references public.conversation_threads(id, user_id) on delete cascade
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  table_name text not null,
  record_id uuid not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index financial_entities_user_kind_idx on public.financial_entities(user_id, kind, status);
create index recurring_values_entity_period_idx on public.recurring_values(entity_id, effective_from, effective_until);
create index transactions_user_date_idx on public.transactions(user_id, occurred_on);
create index installments_user_month_idx on public.installments(user_id, statement_month);
create index messages_thread_date_idx on public.conversation_messages(thread_id, created_at);
create index audit_user_date_idx on public.audit_log(user_id, created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger entities_updated_at before update on public.financial_entities for each row execute function public.set_updated_at();
create trigger overrides_updated_at before update on public.monthly_overrides for each row execute function public.set_updated_at();
create trigger transactions_updated_at before update on public.transactions for each row execute function public.set_updated_at();
create trigger threads_updated_at before update on public.conversation_threads for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.capture_audit() returns trigger language plpgsql security definer set search_path = '' as $$
declare row_user_id uuid; row_id uuid;
begin
  row_user_id := coalesce((to_jsonb(new) ->> 'user_id')::uuid, (to_jsonb(old) ->> 'user_id')::uuid);
  row_id := coalesce((to_jsonb(new) ->> 'id')::uuid, (to_jsonb(old) ->> 'id')::uuid);
  insert into public.audit_log(user_id, table_name, record_id, operation, old_data, new_data)
  values (row_user_id, tg_table_name, row_id, tg_op, case when tg_op = 'INSERT' then null else to_jsonb(old) end, case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger audit_entities after insert or update or delete on public.financial_entities for each row execute function public.capture_audit();
create trigger audit_recurring_values after insert or update or delete on public.recurring_values for each row execute function public.capture_audit();
create trigger audit_monthly_overrides after insert or update or delete on public.monthly_overrides for each row execute function public.capture_audit();
create trigger audit_transactions after insert or update or delete on public.transactions for each row execute function public.capture_audit();
create trigger audit_installments after insert or update or delete on public.installments for each row execute function public.capture_audit();
create trigger audit_settlements after insert or update or delete on public.debt_settlements for each row execute function public.capture_audit();

alter table public.profiles enable row level security;
alter table public.financial_entities enable row level security;
alter table public.financial_entity_aliases enable row level security;
alter table public.recurring_values enable row level security;
alter table public.monthly_overrides enable row level security;
alter table public.transactions enable row level security;
alter table public.installments enable row level security;
alter table public.debt_settlements enable row level security;
alter table public.conversation_threads enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_own_all on public.profiles for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy entities_own_all on public.financial_entities for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy aliases_own_all on public.financial_entity_aliases for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy recurring_own_all on public.recurring_values for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy overrides_own_all on public.monthly_overrides for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy transactions_own_all on public.transactions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy installments_own_all on public.installments for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy settlements_own_all on public.debt_settlements for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy threads_own_all on public.conversation_threads for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy messages_own_all on public.conversation_messages for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy audit_own_select on public.audit_log for select to authenticated using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.audit_log from anon, authenticated;

commit;
