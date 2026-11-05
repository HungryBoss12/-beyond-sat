-- A balance set below the current balance is one manual charge with no class.
-- Class fee charges still have to name a class or a group.

ALTER TABLE public.ledger_entries DROP CONSTRAINT IF EXISTS ledger_charge_has_class;
ALTER TABLE public.ledger_entries
  ADD CONSTRAINT ledger_charge_has_class CHECK (
    kind <> 'charge'
    OR class_id IS NOT NULL
    OR group_id IS NOT NULL
    OR (source = 'manual' AND note = 'Balance set by admin')
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261105000001', 'balance_adjustment_charge')
ON CONFLICT (version) DO NOTHING;
