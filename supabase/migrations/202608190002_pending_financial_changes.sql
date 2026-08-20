begin;

create table public.pending_financial_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_thread_id uuid not null,
  action text not null check (action in ('create_entity', 'rename_entity')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  confirmed_at timestamptz
);

create index pending_changes_user_thread_idx on public.pending_financial_changes(user_id, client_thread_id, created_at desc);
alter table public.pending_financial_changes enable row level security;
create policy pending_changes_own_select on public.pending_financial_changes for select to authenticated using ((select auth.uid()) = user_id);
create policy pending_changes_own_insert on public.pending_financial_changes for insert to authenticated with check ((select auth.uid()) = user_id and status = 'pending');
revoke update, delete on public.pending_financial_changes from anon, authenticated;

create or replace function public.confirm_financial_change(p_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.pending_financial_changes%rowtype;
  v_entity_id uuid;
  v_old_name text;
  v_old_normalized text;
begin
  select * into v_draft
  from public.pending_financial_changes
  where id = p_draft_id and user_id = auth.uid()
  for update;

  if not found then raise exception 'Rascunho não encontrado.'; end if;
  if v_draft.status <> 'pending' then raise exception 'Rascunho já processado.'; end if;
  if v_draft.expires_at <= now() then
    update public.pending_financial_changes set status = 'expired' where id = v_draft.id;
    raise exception 'Rascunho expirado.';
  end if;

  if v_draft.action = 'create_entity' then
    insert into public.financial_entities (
      user_id, kind, name, normalized_name, closing_day, due_day, active_from
    ) values (
      v_draft.user_id,
      v_draft.payload ->> 'kind',
      v_draft.payload ->> 'name',
      v_draft.payload ->> 'normalizedName',
      nullif(v_draft.payload ->> 'closingDay', '')::smallint,
      nullif(v_draft.payload ->> 'dueDay', '')::smallint,
      (v_draft.payload ->> 'effectiveFrom')::date
    ) returning id into v_entity_id;

    if v_draft.payload ? 'amountCents' then
      insert into public.recurring_values(user_id, entity_id, amount_cents, effective_from)
      values (v_draft.user_id, v_entity_id, (v_draft.payload ->> 'amountCents')::bigint, (v_draft.payload ->> 'effectiveFrom')::date);
    end if;
  elsif v_draft.action = 'rename_entity' then
    v_entity_id := (v_draft.payload ->> 'entityId')::uuid;
    select name, normalized_name into v_old_name, v_old_normalized
    from public.financial_entities where id = v_entity_id and user_id = v_draft.user_id for update;
    if not found then raise exception 'Entidade financeira não encontrada.'; end if;

    update public.financial_entities
    set name = v_draft.payload ->> 'newName', normalized_name = v_draft.payload ->> 'newNormalizedName'
    where id = v_entity_id and user_id = v_draft.user_id;

    insert into public.financial_entity_aliases(user_id, entity_id, alias, normalized_alias)
    values (v_draft.user_id, v_entity_id, v_old_name, v_old_normalized)
    on conflict (user_id, normalized_alias) do nothing;
  else
    raise exception 'Ação financeira inválida.';
  end if;

  update public.pending_financial_changes set status = 'confirmed', confirmed_at = now() where id = v_draft.id;
  return jsonb_build_object('draftId', v_draft.id, 'action', v_draft.action, 'entityId', v_entity_id, 'status', 'confirmed');
end;
$$;

revoke all on function public.confirm_financial_change(uuid) from public, anon;
grant execute on function public.confirm_financial_change(uuid) to authenticated;

commit;
