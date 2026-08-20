begin;

alter table public.pending_financial_changes drop constraint if exists pending_financial_changes_action_check;
alter table public.pending_financial_changes
  add constraint pending_financial_changes_action_check
  check (action in ('create_entity', 'rename_entity', 'update_value', 'close_entity', 'create_transaction', 'update_transaction', 'void_transaction'));

create or replace function public.confirm_transaction_revision(p_draft_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_draft public.pending_financial_changes%rowtype;
  v_transaction public.transactions%rowtype;
  v_result jsonb;
  v_count integer;
  v_total bigint;
  v_base bigint;
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
  if v_draft.action not in ('update_transaction', 'void_transaction') then raise exception 'Rascunho não é uma revisão.'; end if;

  select * into v_transaction from public.transactions
  where id = (v_draft.payload ->> 'transactionId')::uuid and user_id = v_draft.user_id for update;
  if not found then raise exception 'Lançamento não encontrado.'; end if;
  if v_transaction.status = 'voided' then raise exception 'Lançamento já desfeito.'; end if;

  if v_draft.action = 'update_transaction' then
    v_total := (v_draft.payload ->> 'amountCents')::bigint;
    update public.transactions set amount_cents = v_total, category = v_draft.payload ->> 'category', updated_at = now()
      where id = v_transaction.id and user_id = v_draft.user_id;

    select count(*) into v_count from public.installments
      where transaction_id = v_transaction.id and user_id = v_draft.user_id and status <> 'voided';
    if v_count > 0 then
      v_base := v_total / v_count;
      if v_base <= 0 then raise exception 'O valor é insuficiente para a quantidade de parcelas.'; end if;
      update public.installments set amount_cents = case when installment_number = v_count
        then v_total - (v_base * (v_count - 1)) else v_base end
      where transaction_id = v_transaction.id and user_id = v_draft.user_id and status <> 'voided';
    end if;
  else
    update public.transactions set status = 'voided', updated_at = now()
      where id = v_transaction.id and user_id = v_draft.user_id;
    update public.installments set status = 'voided'
      where transaction_id = v_transaction.id and user_id = v_draft.user_id and status <> 'voided';
  end if;

  v_result := jsonb_build_object('draftId', v_draft.id, 'action', v_draft.action,
    'referenceId', v_transaction.id, 'status', 'confirmed');
  update public.pending_financial_changes set status = 'confirmed', confirmed_at = now(), result = v_result where id = v_draft.id;
  return v_result;
end;
$$;

revoke all on function public.confirm_transaction_revision(uuid) from public, anon;
grant execute on function public.confirm_transaction_revision(uuid) to authenticated;

commit;
