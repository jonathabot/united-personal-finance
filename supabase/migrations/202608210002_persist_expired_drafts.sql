begin;

create or replace function public.mark_expired_financial_change(p_draft_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_draft public.pending_financial_changes%rowtype;
begin
  select * into v_draft
  from public.pending_financial_changes
  where id = p_draft_id and user_id = auth.uid()
  for update;

  if not found then return null; end if;

  if v_draft.status = 'expired'
    or (v_draft.status = 'pending' and v_draft.expires_at <= now()) then
    update public.pending_financial_changes
    set status = 'expired'
    where id = v_draft.id and status = 'pending';

    return jsonb_build_object(
      'draftId', v_draft.id,
      'action', v_draft.action,
      'status', 'expired',
      'error', 'Rascunho expirado.'
    );
  end if;

  return null;
end;
$$;

alter function public.confirm_financial_change(uuid) rename to confirm_financial_change_active;
alter function public.confirm_installment_transaction(uuid) rename to confirm_installment_transaction_active;
alter function public.confirm_extended_transaction(uuid) rename to confirm_extended_transaction_active;
alter function public.confirm_installment_anticipation(uuid) rename to confirm_installment_anticipation_active;
alter function public.confirm_transaction_revision(uuid) rename to confirm_transaction_revision_active;

create function public.confirm_financial_change(p_draft_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_expired jsonb;
begin
  v_expired := public.mark_expired_financial_change(p_draft_id);
  if v_expired is not null then return v_expired; end if;
  return public.confirm_financial_change_active(p_draft_id);
end;
$$;

create function public.confirm_installment_transaction(p_draft_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_expired jsonb;
begin
  v_expired := public.mark_expired_financial_change(p_draft_id);
  if v_expired is not null then return v_expired; end if;
  return public.confirm_installment_transaction_active(p_draft_id);
end;
$$;

create function public.confirm_extended_transaction(p_draft_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_expired jsonb;
begin
  v_expired := public.mark_expired_financial_change(p_draft_id);
  if v_expired is not null then return v_expired; end if;
  return public.confirm_extended_transaction_active(p_draft_id);
end;
$$;

create function public.confirm_installment_anticipation(p_draft_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_expired jsonb;
begin
  v_expired := public.mark_expired_financial_change(p_draft_id);
  if v_expired is not null then return v_expired; end if;
  return public.confirm_installment_anticipation_active(p_draft_id);
end;
$$;

create function public.confirm_transaction_revision(p_draft_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_expired jsonb;
begin
  v_expired := public.mark_expired_financial_change(p_draft_id);
  if v_expired is not null then return v_expired; end if;
  return public.confirm_transaction_revision_active(p_draft_id);
end;
$$;

revoke all on function public.mark_expired_financial_change(uuid) from public, anon, authenticated;
revoke all on function public.confirm_financial_change_active(uuid) from public, anon, authenticated;
revoke all on function public.confirm_installment_transaction_active(uuid) from public, anon, authenticated;
revoke all on function public.confirm_extended_transaction_active(uuid) from public, anon, authenticated;
revoke all on function public.confirm_installment_anticipation_active(uuid) from public, anon, authenticated;
revoke all on function public.confirm_transaction_revision_active(uuid) from public, anon, authenticated;

revoke all on function public.confirm_financial_change(uuid) from public, anon;
revoke all on function public.confirm_installment_transaction(uuid) from public, anon;
revoke all on function public.confirm_extended_transaction(uuid) from public, anon;
revoke all on function public.confirm_installment_anticipation(uuid) from public, anon;
revoke all on function public.confirm_transaction_revision(uuid) from public, anon;

grant execute on function public.confirm_financial_change(uuid) to authenticated;
grant execute on function public.confirm_installment_transaction(uuid) to authenticated;
grant execute on function public.confirm_extended_transaction(uuid) to authenticated;
grant execute on function public.confirm_installment_anticipation(uuid) to authenticated;
grant execute on function public.confirm_transaction_revision(uuid) to authenticated;

commit;
