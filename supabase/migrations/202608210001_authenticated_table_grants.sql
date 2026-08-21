begin;

grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.financial_entities,
  public.financial_entity_aliases,
  public.recurring_values,
  public.monthly_overrides,
  public.transactions,
  public.installments,
  public.debt_settlements,
  public.conversation_threads,
  public.conversation_messages
to authenticated;

grant select, insert on table public.pending_financial_changes to authenticated;
grant select on table public.audit_log to authenticated;

revoke insert, update, delete on table public.audit_log from anon, authenticated;
revoke update, delete on table public.pending_financial_changes from anon, authenticated;

commit;
