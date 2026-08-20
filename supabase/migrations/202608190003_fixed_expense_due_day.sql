begin;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid = 'public.financial_entities'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%closing_day%'
      and pg_get_constraintdef(oid) ilike '%due_day%'
  loop
    execute format('alter table public.financial_entities drop constraint %I', constraint_name);
  end loop;
end;
$$;

alter table public.financial_entities
  add constraint financial_entities_closing_day_kind_check
    check (kind = 'credit_card' or closing_day is null),
  add constraint financial_entities_due_day_kind_check
    check (kind in ('credit_card', 'fixed_expense', 'loan') or due_day is null);

commit;
