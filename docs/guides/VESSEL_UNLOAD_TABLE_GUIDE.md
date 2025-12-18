# Database Update Guide: Vessel Unload Table

This guide provides SQL scripts to create the `dbo_vessel_unload` table in Supabase and set up Row Level Security (RLS) policies.

**Prerequisites:**
- The `dbo_gear_unload` table must exist (see `docs/GEAR_UNLOAD_TABLE_GUIDE.md`)
- The `dbo_vessel` table must exist (see `docs/VESSEL_TABLE_GUIDE.md`)
- The `dbo_fishing_effort` table must exist (see `docs/FISHING_EFFORT_TABLE_GUIDE.md`)
- The `public.get_user_role_and_region()` function should exist (will be created in Step 2 if it doesn't)

---

## Step 1: Create the Table

Run this SQL script in your Supabase SQL Editor to create the `dbo_vessel_unload` table:

```sql
-- Create dbo_vessel_unload table
-- IMPORTANT: Column names without quotes are converted to lowercase in PostgreSQL
CREATE TABLE IF NOT EXISTS public.dbo_vessel_unload (
    v_unload_id SERIAL PRIMARY KEY,  -- Will be stored as 'v_unload_id' (lowercase)
    unload_gr_id INTEGER NOT NULL REFERENCES public.dbo_gear_unload(unload_gr_id),
    boat_id INTEGER NOT NULL REFERENCES public.dbo_vessel(boat_id),
    effort NUMERIC(12, 2) NOT NULL DEFAULT 0,  -- Primary effort value
    uniteffort_id INTEGER NOT NULL REFERENCES public.dbo_fishing_effort(uniteffort_id),
    boxes_total INTEGER,
    catch_total NUMERIC(12, 2),  -- Catch total in kg
    boxes_samp INTEGER,
    catch_samp NUMERIC(12, 2),  -- Catch sample in kg
    boxes_pieces_id INTEGER,
    effort_2 NUMERIC(12, 2),  -- Secondary effort value (optional)
    uniteffort_2_id INTEGER REFERENCES public.dbo_fishing_effort(uniteffort_id),
    effort_3 NUMERIC(12, 2),  -- Tertiary effort value (optional)
    uniteffort_3_id INTEGER REFERENCES public.dbo_fishing_effort(uniteffort_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment to table
COMMENT ON TABLE public.dbo_vessel_unload IS 'Vessel unload records with catch and effort data';

-- Add comments to columns
COMMENT ON COLUMN public.dbo_vessel_unload.v_unload_id IS 'Primary key for vessel unload record';
COMMENT ON COLUMN public.dbo_vessel_unload.unload_gr_id IS 'Foreign key to dbo_gear_unload';
COMMENT ON COLUMN public.dbo_vessel_unload.boat_id IS 'Foreign key to dbo_vessel (vessel used)';
COMMENT ON COLUMN public.dbo_vessel_unload.effort IS 'Primary effort value (number)';
COMMENT ON COLUMN public.dbo_vessel_unload.uniteffort_id IS 'Foreign key to dbo_fishing_effort (primary fishing effort unit)';
COMMENT ON COLUMN public.dbo_vessel_unload.boxes_total IS 'Total number of boxes';
COMMENT ON COLUMN public.dbo_vessel_unload.catch_total IS 'Total catch in kilograms';
COMMENT ON COLUMN public.dbo_vessel_unload.boxes_samp IS 'Number of sample boxes';
COMMENT ON COLUMN public.dbo_vessel_unload.catch_samp IS 'Sample catch in kilograms';
COMMENT ON COLUMN public.dbo_vessel_unload.boxes_pieces_id IS 'Boxes pieces ID';
COMMENT ON COLUMN public.dbo_vessel_unload.effort_2 IS 'Secondary effort value (optional)';
COMMENT ON COLUMN public.dbo_vessel_unload.uniteffort_2_id IS 'Foreign key to dbo_fishing_effort (secondary fishing effort unit, optional)';
COMMENT ON COLUMN public.dbo_vessel_unload.effort_3 IS 'Tertiary effort value (optional)';
COMMENT ON COLUMN public.dbo_vessel_unload.uniteffort_3_id IS 'Foreign key to dbo_fishing_effort (tertiary fishing effort unit, optional)';
COMMENT ON COLUMN public.dbo_vessel_unload.created_at IS 'Timestamp when record was created';
COMMENT ON COLUMN public.dbo_vessel_unload.updated_at IS 'Timestamp when record was last updated';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vessel_unload_gear_unload ON public.dbo_vessel_unload(unload_gr_id);
CREATE INDEX IF NOT EXISTS idx_vessel_unload_vessel ON public.dbo_vessel_unload(boat_id);
CREATE INDEX IF NOT EXISTS idx_vessel_unload_effort ON public.dbo_vessel_unload(uniteffort_id);

-- Create function to update updated_at timestamp (if not already exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_dbo_vessel_unload_updated_at ON public.dbo_vessel_unload;
CREATE TRIGGER update_dbo_vessel_unload_updated_at
    BEFORE UPDATE ON public.dbo_vessel_unload
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## Step 2: Create Helper Function (Required for RLS)

**IMPORTANT:** Before creating RLS policies, you must create the helper function `public.get_user_role_and_region()`. This function is used by all RLS policies to check user roles and regions.

**Note:** Supabase restricts access to the `auth` schema, so we create this function in the `public` schema instead.

If this function doesn't exist yet, run this script:

```sql
-- Create helper function to get current user's role and region
-- This function is used by RLS policies for region-based filtering
-- Note: Created in public schema because auth schema is restricted in Supabase
CREATE OR REPLACE FUNCTION public.get_user_role_and_region()
RETURNS TABLE (role text, region_id int) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    u.role::TEXT,
    u.region_id
  FROM public.dbo_user u
  WHERE u.user_id = auth.uid();
END;
$$;
```

**Note:** If you've already created this function for other tables (like `dbo_vessel` or `dbo_gear_unload`), you can skip this step.

---

## Step 3: Enable Row Level Security (RLS)

Enable RLS on the table:

```sql
-- Enable Row Level Security
ALTER TABLE public.dbo_vessel_unload ENABLE ROW LEVEL SECURITY;
```

---

## Step 4: Create RLS Policies

Since `dbo_vessel_unload` references `dbo_gear_unload` which references `dbo_LC_FG_sample_day` (which has `region_id`), we'll implement region-based filtering through the gear unload -> sample day relationship:
- **Superadmin/Admin**: Can view and manage all vessel unload records
- **Encoder**: Can view and manage vessel unloads for gear unloads in their region only
- **Viewer**: Can view vessel unloads for gear unloads in their region only (read-only)

```sql
-- Drop existing policies if they exist (to start fresh)
DROP POLICY IF EXISTS "RBAC Select Vessel Unload" ON public.dbo_vessel_unload;
DROP POLICY IF EXISTS "RBAC Insert Vessel Unload" ON public.dbo_vessel_unload;
DROP POLICY IF EXISTS "RBAC Update Vessel Unload" ON public.dbo_vessel_unload;
DROP POLICY IF EXISTS "RBAC Delete Vessel Unload" ON public.dbo_vessel_unload;

-- SELECT: Admins see all, Encoders/Viewers see own region (through gear unload -> sample day)
-- Note: "dbo_LC_FG_sample_day" must be quoted to preserve case
-- IMPORTANT: Use table alias (ur) to avoid ambiguous column reference
CREATE POLICY "RBAC Select Vessel Unload" ON public.dbo_vessel_unload FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.get_user_role_and_region() AS ur
    WHERE ur.role IN ('superadmin', 'admin')
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.dbo_gear_unload gu
    INNER JOIN public."dbo_LC_FG_sample_day" sd ON sd.unload_day_id = gu.unload_day_id
    INNER JOIN public.get_user_role_and_region() AS ur ON true
    WHERE gu.unload_gr_id = dbo_vessel_unload.unload_gr_id
    AND sd.region_id = ur.region_id
  )
);

-- INSERT: Admins and Encoders (for their region through gear unload -> sample day)
CREATE POLICY "RBAC Insert Vessel Unload" ON public.dbo_vessel_unload FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.get_user_role_and_region() AS ur
    WHERE ur.role IN ('superadmin', 'admin')
  )
  OR 
  (
    EXISTS (
      SELECT 1 FROM public.get_user_role_and_region() AS ur
      WHERE ur.role = 'encoder'
    )
    AND EXISTS (
      SELECT 1 FROM public.dbo_gear_unload gu
      INNER JOIN public."dbo_LC_FG_sample_day" sd ON sd.unload_day_id = gu.unload_day_id
      INNER JOIN public.get_user_role_and_region() AS ur ON true
      WHERE gu.unload_gr_id = dbo_vessel_unload.unload_gr_id
      AND sd.region_id = ur.region_id
    )
  )
);

-- UPDATE: Admins and Encoders (their region through gear unload -> sample day)
CREATE POLICY "RBAC Update Vessel Unload" ON public.dbo_vessel_unload FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.get_user_role_and_region() AS ur
    WHERE ur.role IN ('superadmin', 'admin')
  )
  OR 
  (
    EXISTS (
      SELECT 1 FROM public.get_user_role_and_region() AS ur
      WHERE ur.role = 'encoder'
    )
    AND EXISTS (
      SELECT 1 FROM public.dbo_gear_unload gu
      INNER JOIN public."dbo_LC_FG_sample_day" sd ON sd.unload_day_id = gu.unload_day_id
      INNER JOIN public.get_user_role_and_region() AS ur ON true
      WHERE gu.unload_gr_id = dbo_vessel_unload.unload_gr_id
      AND sd.region_id = ur.region_id
    )
  )
);

-- DELETE: Admins and Encoders (their region through gear unload -> sample day)
CREATE POLICY "RBAC Delete Vessel Unload" ON public.dbo_vessel_unload FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.get_user_role_and_region() AS ur
    WHERE ur.role IN ('superadmin', 'admin')
  )
  OR 
  (
    EXISTS (
      SELECT 1 FROM public.get_user_role_and_region() AS ur
      WHERE ur.role = 'encoder'
    )
    AND EXISTS (
      SELECT 1 FROM public.dbo_gear_unload gu
      INNER JOIN public."dbo_LC_FG_sample_day" sd ON sd.unload_day_id = gu.unload_day_id
      INNER JOIN public.get_user_role_and_region() AS ur ON true
      WHERE gu.unload_gr_id = dbo_vessel_unload.unload_gr_id
      AND sd.region_id = ur.region_id
    )
  )
);
```

---

## Step 5: Verify the Table

Run these queries to verify the table was created correctly:

```sql
-- Check table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'dbo_vessel_unload'
ORDER BY ordinal_position;

-- Check foreign key constraints
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'dbo_vessel_unload';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'dbo_vessel_unload';

-- Check policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'dbo_vessel_unload';
```

---

## Step 6: Insert Sample Data (Optional)

You can insert some sample data to test:

```sql
-- First, ensure you have gear unload, vessel, and fishing effort records
-- Then insert sample vessel unload records
-- Note: Replace the IDs with actual values from your tables

INSERT INTO public.dbo_vessel_unload (unload_gr_id, boat_id, effort, uniteffort_id, boxes_total, catch_total, boxes_samp, catch_samp, boxes_pieces_id, effort_2, uniteffort_2_id, effort_3, uniteffort_3_id) VALUES
    (1, 1, 5.5, 1, 10, 250.50, 2, 50.25, 1, 3.2, 2, NULL, NULL),
    (1, 2, 4.0, 1, 8, 200.00, 1, 25.00, 1, NULL, NULL, NULL, NULL),
    (2, 1, 6.0, 1, 12, 300.75, 3, 75.50, 2, 2.5, 2, 1.0, 3)
ON CONFLICT DO NOTHING;
```

**Note:** 
- Replace `unload_gr_id` values (1, 2) with actual gear unload IDs from your `dbo_gear_unload` table
- Replace `boat_id` values (1, 2) with actual vessel IDs from your `dbo_vessel` table
- Replace `uniteffort_id` values (1, 2, 3) with actual fishing effort IDs from your `dbo_fishing_effort` table
- `effort`, `effort_2`, `effort_3` are numeric values
- Optional fields can be NULL

---

## Troubleshooting

### Error: "function public.get_user_role_and_region() does not exist"

This error means the helper function hasn't been created yet. **You must create the function BEFORE creating the RLS policies.**

Run the function creation script from **Step 2** above. The function should be created in the `public` schema (Supabase restricts access to the `auth` schema).

### Error: "permission denied for schema auth"

This error occurs when trying to create a function in the `auth` schema. **Solution:** Use the `public` schema instead. All the scripts in this guide use `public.get_user_role_and_region()`.

### Error: "column reference 'role' is ambiguous"

This error occurs when the RLS policy doesn't use a table alias for the function result. **Solution:** Use `EXISTS` with a table alias (`AS ur`) as shown in the corrected policies above. All policies in this guide have been updated to use explicit aliases to avoid this ambiguity.

The corrected policies use:
```sql
EXISTS (
  SELECT 1 FROM public.get_user_role_and_region() AS ur
  WHERE ur.role IN ('superadmin', 'admin')
)
```

Instead of:
```sql
(SELECT role FROM public.get_user_role_and_region()) IN ('superadmin', 'admin')
```

### Error: "relation dbo_gear_unload does not exist"

Make sure you've created the `dbo_gear_unload` table first. See `docs/GEAR_UNLOAD_TABLE_GUIDE.md`.

### Error: "relation dbo_vessel does not exist"

Make sure you've created the `dbo_vessel` table first. See `docs/VESSEL_TABLE_GUIDE.md`.

### Error: "relation dbo_fishing_effort does not exist"

Make sure you've created the `dbo_fishing_effort` table first. See `docs/FISHING_EFFORT_TABLE_GUIDE.md`.

### Error: "column v_unload_id does not exist"

Check the actual column name in your database. PostgreSQL converts unquoted identifiers to lowercase, so the column should be `v_unload_id` (all lowercase). If you used quotes when creating the table, you may need to use quotes in queries as well.

---

## Verification Checklist

After running the scripts, verify:

- [ ] Table `dbo_vessel_unload` exists
- [ ] Columns are correct: `v_unload_id`, `unload_gr_id`, `boat_id`, `effort`, `uniteffort_id`, `boxes_total`, `catch_total`, `boxes_samp`, `catch_samp`, `boxes_pieces_id`, `effort_2`, `uniteffort_2_id`, `effort_3`, `uniteffort_3_id`, `created_at`, `updated_at`
- [ ] Foreign key constraints are created (to `dbo_gear_unload`, `dbo_vessel`, and `dbo_fishing_effort`)
- [ ] RLS is enabled on the table
- [ ] Policies are created (4 policies: SELECT, INSERT, UPDATE, DELETE)
- [ ] Indexes exist on `unload_gr_id`, `boat_id`, and `uniteffort_id`
- [ ] Trigger for `updated_at` is working
- [ ] Can read data as authenticated user (filtered by region for encoder/viewer)
- [ ] Can insert/update/delete as admin (all regions)
- [ ] Can insert/update/delete as encoder (own region only, through gear unload -> sample day)
- [ ] Cannot insert/update/delete as viewer

---

## Related Documentation

- `docs/SECURITY.md` - Security documentation including RLS policies
- `docs/RLS_POLICIES.md` - RLS policy implementation details
- `docs/GEAR_UNLOAD_TABLE_GUIDE.md` - Gear unload table setup (required before vessel unload table)
- `docs/VESSEL_TABLE_GUIDE.md` - Vessel table setup (required before vessel unload table)
- `docs/FISHING_EFFORT_TABLE_GUIDE.md` - Fishing effort table setup (required before vessel unload table)
- `docs/DATABASE_UPDATE_GUIDE.md` - Other database update scripts

---

**Last Updated:** January 2025  
**Status:** Ready for Implementation
