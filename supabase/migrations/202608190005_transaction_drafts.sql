begin;

alter table public.pending_financial_changes drop constraint if exists pending_financial_changes_action_check;
alter table public.pending_financial_changes
  add constraint pending_financial_changes_action_check
  check (action in ('create_entity', 'rename_entity', 'update_value', 'close_entity', 'create_transaction'));

create or replace function public.confirm_financial_change(p_draft_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_draft public.pending_financial_changes%rowtype;
  v_reference_id uuid;
  v_old_name text;
  v_old_normalized text;
  v_result jsonb;
  v_effective date;
begin
  select * into v_draft from public.pending_financial_changes
  where id = p_draft_id and user_id = auth.uid() for update;

  if not found then raise exception 'Rascunho não encontrado.'; end if;
  if v_draft.status = 'confirmed' and v_draft.result is not null then return v_draft.result; end if;
  if v_draft.status <> 'pending' then raise exception 'Rascunho já processado.'; end if;
  if v_draft.expires_at <= now() then
    update public.pending_financial_changes set status = 'expired' where id = v_draft.id;
    raise exception 'Rascunho expirado.';
  end if;

  if v_draft.action = 'create_entity' then
    insert into public.financial_entities(user_id, kind, name, normalized_name, closing_day, due_day, active_from)
    values (v_draft.user_id, v_draft.payload ->> 'kind', v_draft.payload ->> 'name', v_draft.payload ->> 'normalizedName',
      nullif(v_draft.payload ->> 'closingDay', '')::smallint, nullif(v_draft.payload ->> 'dueDay', '')::smallint,
      (v_draft.payload ->> 'effectiveFrom')::date)
    returning id into v_reference_id;
    if v_draft.payload ? 'amountCents' then
      insert into public.recurring_values(user_id, entity_id, amount_cents, effective_from)
      values (v_draft.user_id, v_reference_id, (v_draft.payload ->> 'amountCents')::bigint, (v_draft.payload ->> 'effectiveFrom')::date);
    end if;
  elsif v_draft.action = 'rename_entity' then
    v_reference_id := (v_draft.payload ->> 'entityId')::uuid;
    select name, normalized_name into v_old_name, v_old_normalized from public.financial_entities
      where id = v_reference_id and user_id = v_draft.user_id for update;
    if not found then raise exception 'Entidade financeira não encontrada.'; end if;
    update public.financial_entities set name = v_draft.payload ->> 'newName', normalized_name = v_draft.payload ->> 'newNormalizedName'
      where id = v_reference_id and user_id = v_draft.user_id;
    insert into public.financial_entity_aliases(user_id, entity_id, alias, normalized_alias)
      values (v_draft.user_id, v_reference_id, v_old_name, v_old_normalized)
      on conflict (user_id, normalized_alias) do nothing;
  elsif v_draft.action = 'update_value' then
    v_reference_id := (v_draft.payload ->> 'entityId')::uuid;
    v_effective := (v_draft.payload ->> 'effectiveFrom')::date;
    perform 1 from public.financial_entities where id = v_reference_id and user_id = v_draft.user_id for update;
    if not found then raise exception 'Entidade financeira não encontrada.'; end if;
    update public.recurring_values set effective_until = (v_effective - interval '1 month')::date
      where user_id = v_draft.user_id and entity_id = v_reference_id and effective_from < v_effective
        and (effective_until is null or effective_until >= v_effective);
    insert into public.recurring_values(user_id, entity_id, amount_cents, effective_from, effective_until)
      values (v_draft.user_id, v_reference_id, (v_draft.payload ->> 'amountCents')::bigint, v_effective,
        (select (min(effective_from) - interval '1 month')::date from public.recurring_values
          where user_id = v_draft.user_id and entity_id = v_reference_id and effective_from > v_effective))
      on conflict (entity_id, effective_from) do update set amount_cents = excluded.amount_cents;
  elsif v_draft.action = 'close_entity' then
    v_reference_id := (v_draft.payload ->> 'entityId')::uuid;
    v_effective := (v_draft.payload ->> 'inactiveFrom')::date;
    update public.financial_entities set active_until = (v_effective - interval '1 day')::date,
      status = (v_draft.payload ->> 'status')
      where id = v_reference_id and user_id = v_draft.user_id;
    if not found then raise exception 'Entidade financeira não encontrada.'; end if;
    update public.recurring_values set effective_until = (v_effective - interval '1 month')::date
      where user_id = v_draft.user_id and entity_id = v_reference_id and effective_from < v_effective
        and (effective_until is null or effective_until >= v_effective);
  elsif v_draft.action = 'create_transaction' then
    if v_draft.payload ->> 'entityId' is not null then
      perform 1 from public.financial_entities
        where id = (v_draft.payload ->> 'entityId')::uuid and user_id = v_draft.user_id
          and kind in ('credit_card', 'account');
      if not found then raise exception 'Meio de pagamento não encontrado.'; end if;
    end if;
    insert into public.transactions(user_id, entity_id, type, amount_cents, occurred_on, description, category, belongs_to_third_party, status)
    values (v_draft.user_id, nullif(v_draft.payload ->> 'entityId', '')::uuid, v_draft.payload ->> 'type',
      (v_draft.payload ->> 'amountCents')::bigint, (v_draft.payload ->> 'occurredOn')::date,
      v_draft.payload ->> 'description', v_draft.payload ->> 'category',
      coalesce((v_draft.payload ->> 'belongsToThirdParty')::boolean, false), 'confirmed')
    returning id into v_reference_id;
  else
    raise exception 'Ação financeira inválida.';
  end if;

  v_result := jsonb_build_object('draftId', v_draft.id, 'action', v_draft.action,
    'referenceId', v_reference_id, 'status', 'confirmed');
  update public.pending_financial_changes set status = 'confirmed', confirmed_at = now(), result = v_result where id = v_draft.id;
  return v_result;
end;
$$;

revoke all on function public.confirm_financial_change(uuid) from public, anon;
grant execute on function public.confirm_financial_change(uuid) to authenticated;

commit;
