begin;

create or replace function public.confirm_installment_transaction(p_draft_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_draft public.pending_financial_changes%rowtype;
  v_transaction_id uuid;
  v_installment jsonb;
  v_result jsonb;
  v_count integer;
  v_sum bigint;
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
  if v_draft.action <> 'create_transaction' then raise exception 'Rascunho não é uma transação.'; end if;

  v_count := (v_draft.payload ->> 'installmentCount')::integer;
  select coalesce(sum((item ->> 'amountCents')::bigint), 0) into v_sum
    from jsonb_array_elements(v_draft.payload -> 'installmentSchedule') item;
  if v_count <= 1 or jsonb_array_length(v_draft.payload -> 'installmentSchedule') <> v_count
    or v_sum <> (v_draft.payload ->> 'amountCents')::bigint then
    raise exception 'Cronograma de parcelas inválido.';
  end if;

  perform 1 from public.financial_entities
    where id = (v_draft.payload ->> 'entityId')::uuid and user_id = v_draft.user_id and kind = 'credit_card';
  if not found then raise exception 'Cartão não encontrado.'; end if;

  insert into public.transactions(user_id, entity_id, type, amount_cents, occurred_on, description, category, belongs_to_third_party, status)
  values (v_draft.user_id, (v_draft.payload ->> 'entityId')::uuid, 'expense',
    (v_draft.payload ->> 'amountCents')::bigint, (v_draft.payload ->> 'occurredOn')::date,
    v_draft.payload ->> 'description', v_draft.payload ->> 'category',
    coalesce((v_draft.payload ->> 'belongsToThirdParty')::boolean, false), 'confirmed')
  returning id into v_transaction_id;

  for v_installment in select value from jsonb_array_elements(v_draft.payload -> 'installmentSchedule') loop
    insert into public.installments(user_id, transaction_id, entity_id, installment_number, installment_count, statement_month, amount_cents, status)
    values (v_draft.user_id, v_transaction_id, (v_draft.payload ->> 'entityId')::uuid,
      (v_installment ->> 'number')::integer, v_count, ((v_installment ->> 'statementMonth') || '-01')::date,
      (v_installment ->> 'amountCents')::bigint, 'scheduled');
  end loop;

  v_result := jsonb_build_object('draftId', v_draft.id, 'action', v_draft.action,
    'referenceId', v_transaction_id, 'status', 'confirmed', 'installmentCount', v_count);
  update public.pending_financial_changes set status = 'confirmed', confirmed_at = now(), result = v_result where id = v_draft.id;
  return v_result;
end;
$$;

revoke all on function public.confirm_installment_transaction(uuid) from public, anon;
grant execute on function public.confirm_installment_transaction(uuid) to authenticated;

commit;
