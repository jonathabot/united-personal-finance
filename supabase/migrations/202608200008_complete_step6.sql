begin;

alter table public.transactions add column if not exists counterparty_entity_id uuid;
alter table public.transactions add column if not exists related_transaction_id uuid;
alter table public.transactions drop constraint if exists transactions_counterparty_fk;
alter table public.transactions add constraint transactions_counterparty_fk
  foreign key (counterparty_entity_id, user_id) references public.financial_entities(id, user_id) on delete restrict;
alter table public.transactions drop constraint if exists transactions_related_fk;
alter table public.transactions add constraint transactions_related_fk
  foreign key (related_transaction_id, user_id) references public.transactions(id, user_id) on delete restrict;

alter table public.pending_financial_changes drop constraint if exists pending_financial_changes_action_check;
alter table public.pending_financial_changes add constraint pending_financial_changes_action_check check (action in (
  'create_entity', 'rename_entity', 'update_value', 'close_entity', 'create_transaction',
  'update_transaction', 'void_transaction', 'anticipate_installments'
));

create or replace function public.prepare_financial_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.pending_financial_changes set status = 'expired'
    where user_id = new.user_id and status = 'pending' and expires_at <= now();
  update public.pending_financial_changes set status = 'cancelled'
    where user_id = new.user_id and client_thread_id = new.client_thread_id and status = 'pending';
  return new;
end;
$$;
drop trigger if exists prepare_financial_change_before_insert on public.pending_financial_changes;
create trigger prepare_financial_change_before_insert before insert on public.pending_financial_changes
for each row execute function public.prepare_financial_change();
update public.pending_financial_changes set status = 'expired' where status = 'pending' and expires_at <= now();
with ranked as (
  select id, row_number() over (partition by user_id, client_thread_id order by created_at desc) as position
  from public.pending_financial_changes where status = 'pending'
)
update public.pending_financial_changes set status = 'cancelled'
where id in (select id from ranked where position > 1);
create unique index if not exists pending_one_per_thread_idx
  on public.pending_financial_changes(user_id, client_thread_id) where status = 'pending';

create or replace function public.confirm_extended_transaction(p_draft_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_draft public.pending_financial_changes%rowtype;
  v_transaction_id uuid;
  v_type text;
  v_result jsonb;
begin
  select * into v_draft from public.pending_financial_changes where id = p_draft_id and user_id = auth.uid() for update;
  if not found then raise exception 'Rascunho não encontrado.'; end if;
  if v_draft.status = 'confirmed' and v_draft.result is not null then return v_draft.result; end if;
  if v_draft.status <> 'pending' then raise exception 'Rascunho já processado.'; end if;
  if v_draft.expires_at <= now() then update public.pending_financial_changes set status = 'expired' where id = v_draft.id; raise exception 'Rascunho expirado.'; end if;
  if v_draft.action <> 'create_transaction' then raise exception 'Rascunho inválido.'; end if;
  v_type := v_draft.payload ->> 'type';
  if v_type not in ('income', 'refund', 'transfer') then raise exception 'Tipo de lançamento inválido.'; end if;

  if v_draft.payload ->> 'entityId' is not null then
    perform 1 from public.financial_entities where id = (v_draft.payload ->> 'entityId')::uuid and user_id = v_draft.user_id and status = 'active';
    if not found then raise exception 'Conta ou cartão não encontrado.'; end if;
  end if;
  if v_type = 'transfer' then
    perform 1 from public.financial_entities where id = (v_draft.payload ->> 'entityId')::uuid and user_id = v_draft.user_id and kind = 'account';
    if not found then raise exception 'A origem deve ser uma conta.'; end if;
    perform 1 from public.financial_entities where id = (v_draft.payload ->> 'destinationEntityId')::uuid and user_id = v_draft.user_id and kind = 'account';
    if not found then raise exception 'O destino deve ser uma conta.'; end if;
  end if;

  insert into public.transactions(user_id, entity_id, counterparty_entity_id, related_transaction_id, type, amount_cents,
    occurred_on, description, category, belongs_to_third_party, status)
  values (v_draft.user_id, nullif(v_draft.payload ->> 'entityId', '')::uuid,
    nullif(v_draft.payload ->> 'destinationEntityId', '')::uuid,
    nullif(v_draft.payload ->> 'relatedTransactionId', '')::uuid, v_type,
    (v_draft.payload ->> 'amountCents')::bigint, (v_draft.payload ->> 'occurredOn')::date,
    v_draft.payload ->> 'description', v_draft.payload ->> 'category',
    coalesce((v_draft.payload ->> 'belongsToThirdParty')::boolean, false), 'confirmed')
  returning id into v_transaction_id;

  v_result := jsonb_build_object('draftId', v_draft.id, 'action', v_draft.action, 'referenceId', v_transaction_id, 'status', 'confirmed');
  update public.pending_financial_changes set status = 'confirmed', confirmed_at = now(), result = v_result where id = v_draft.id;
  return v_result;
end;
$$;

create or replace function public.confirm_installment_anticipation(p_draft_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_draft public.pending_financial_changes%rowtype;
  v_transaction_id uuid;
  v_expected integer;
  v_updated integer;
  v_result jsonb;
begin
  select * into v_draft from public.pending_financial_changes where id = p_draft_id and user_id = auth.uid() for update;
  if not found then raise exception 'Rascunho não encontrado.'; end if;
  if v_draft.status = 'confirmed' and v_draft.result is not null then return v_draft.result; end if;
  if v_draft.status <> 'pending' then raise exception 'Rascunho já processado.'; end if;
  if v_draft.expires_at <= now() then update public.pending_financial_changes set status = 'expired' where id = v_draft.id; raise exception 'Rascunho expirado.'; end if;
  if v_draft.action <> 'anticipate_installments' then raise exception 'Rascunho inválido.'; end if;
  v_transaction_id := (v_draft.payload ->> 'transactionId')::uuid;
  v_expected := jsonb_array_length(v_draft.payload -> 'installmentIds');

  update public.installments set status = 'anticipated', statement_month = ((v_draft.payload ->> 'targetStatementMonth') || '-01')::date
    where user_id = v_draft.user_id and transaction_id = v_transaction_id and status = 'scheduled'
      and id in (select value::text::uuid from jsonb_array_elements_text(v_draft.payload -> 'installmentIds'));
  get diagnostics v_updated = row_count;
  if v_updated <> v_expected then raise exception 'Uma ou mais parcelas não estão mais disponíveis.'; end if;

  v_result := jsonb_build_object('draftId', v_draft.id, 'action', v_draft.action, 'referenceId', v_transaction_id, 'status', 'confirmed');
  update public.pending_financial_changes set status = 'confirmed', confirmed_at = now(), result = v_result where id = v_draft.id;
  return v_result;
end;
$$;

create or replace function public.confirm_transaction_revision(p_draft_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_draft public.pending_financial_changes%rowtype;
  v_transaction public.transactions%rowtype;
  v_result jsonb;
  v_count integer;
  v_total bigint;
  v_base bigint;
  v_first_month date;
  v_closing smallint;
begin
  select * into v_draft from public.pending_financial_changes where id = p_draft_id and user_id = auth.uid() for update;
  if not found then raise exception 'Rascunho não encontrado.'; end if;
  if v_draft.status = 'confirmed' and v_draft.result is not null then return v_draft.result; end if;
  if v_draft.status <> 'pending' then raise exception 'Rascunho já processado.'; end if;
  if v_draft.expires_at <= now() then update public.pending_financial_changes set status = 'expired' where id = v_draft.id; raise exception 'Rascunho expirado.'; end if;
  if v_draft.action not in ('update_transaction', 'void_transaction') then raise exception 'Rascunho não é uma revisão.'; end if;

  select * into v_transaction from public.transactions where id = (v_draft.payload ->> 'transactionId')::uuid and user_id = v_draft.user_id for update;
  if not found then raise exception 'Lançamento não encontrado.'; end if;
  if v_transaction.status = 'voided' then raise exception 'Lançamento já desfeito.'; end if;

  if v_draft.action = 'update_transaction' then
    v_total := (v_draft.payload ->> 'amountCents')::bigint;
    update public.transactions set amount_cents = v_total, category = v_draft.payload ->> 'category',
      description = v_draft.payload ->> 'description', occurred_on = (v_draft.payload ->> 'occurredOn')::date,
      entity_id = nullif(v_draft.payload ->> 'entityId', '')::uuid,
      belongs_to_third_party = coalesce((v_draft.payload ->> 'belongsToThirdParty')::boolean, false), updated_at = now()
      where id = v_transaction.id and user_id = v_draft.user_id;

    select count(*) into v_count from public.installments where transaction_id = v_transaction.id and user_id = v_draft.user_id and status <> 'voided';
    if v_count > 0 and (v_total <> v_transaction.amount_cents
      or nullif(v_draft.payload ->> 'entityId', '')::uuid is distinct from v_transaction.entity_id
      or (v_draft.payload ->> 'occurredOn')::date <> v_transaction.occurred_on) then
      v_base := v_total / v_count;
      if v_base <= 0 then raise exception 'O valor é insuficiente para a quantidade de parcelas.'; end if;
      select closing_day into v_closing from public.financial_entities
        where id = nullif(v_draft.payload ->> 'entityId', '')::uuid and user_id = v_draft.user_id and kind = 'credit_card';
      if v_closing is null then raise exception 'Parcelamento exige cartão válido.'; end if;
      v_first_month := date_trunc('month', (v_draft.payload ->> 'occurredOn')::date)::date;
      if extract(day from (v_draft.payload ->> 'occurredOn')::date) > v_closing then v_first_month := (v_first_month + interval '1 month')::date; end if;
      update public.installments set entity_id = nullif(v_draft.payload ->> 'entityId', '')::uuid,
        amount_cents = case when installment_number = v_count then v_total - (v_base * (v_count - 1)) else v_base end,
        statement_month = (v_first_month + ((installment_number - 1) || ' months')::interval)::date
        where transaction_id = v_transaction.id and user_id = v_draft.user_id and status <> 'voided';
    end if;
  else
    update public.transactions set status = 'voided', updated_at = now() where id = v_transaction.id and user_id = v_draft.user_id;
    update public.installments set status = 'voided' where transaction_id = v_transaction.id and user_id = v_draft.user_id and status <> 'voided';
  end if;

  v_result := jsonb_build_object('draftId', v_draft.id, 'action', v_draft.action, 'referenceId', v_transaction.id, 'status', 'confirmed');
  update public.pending_financial_changes set status = 'confirmed', confirmed_at = now(), result = v_result where id = v_draft.id;
  return v_result;
end;
$$;

revoke all on function public.confirm_extended_transaction(uuid) from public, anon;
revoke all on function public.confirm_installment_anticipation(uuid) from public, anon;
revoke all on function public.confirm_transaction_revision(uuid) from public, anon;
grant execute on function public.confirm_extended_transaction(uuid) to authenticated;
grant execute on function public.confirm_installment_anticipation(uuid) to authenticated;
grant execute on function public.confirm_transaction_revision(uuid) to authenticated;

commit;
