DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM customers
    WHERE phone IS NOT NULL
    GROUP BY tenant_id, phone
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add customer phone uniqueness: duplicate phone values exist within a tenant';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_tenant_idx"
  ON "customers" USING btree ("phone","tenant_id")
  WHERE "customers"."phone" is not null;
