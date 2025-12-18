# Database Update Guide: Gear Unload Table

This guide provides SQL scripts to create the `dbo_gear_unload` table in Supabase and set up Row Level Security (RLS) policies.

**Prerequisites:**
- The `dbo_LC_FG_sample_day` table must exist (see sample days setup)
  - **Important:** This table name uses mixed case and must be referenced with quotes: `"dbo_LC_FG_sample_day"`
- The `dbo_gear` table must exist (see `docs/GEAR_TABLE_GUIDE.md`)
- The `public.get_user_role_and_region()` function should exist (will be created in Step 2 if it doesn't)

---

## Step 1: Create the Table

Run this SQL script in your Supabase SQL Editor to create the `dbo_gear_unload` table:

```sql
-- Create dbo_gear_unload table
-- IMPORTANT: Column names without quotes are converted to lowercase in PostgreSQL
-- IMPORTANT: Table name "dbo_LC_FG_sample_day" must be quoted to preserve case
-- IMPORTANT: unload_day_id is UUID type, not INTEGER
CREATE TABLE IF NOT EXISTS public.dbo_gear_unload (
    unload_gr_id SERIAL PRIMARY KEY,  -- Will be stored as 'unload_gr_id' (lowercase)
    unload_day_id UUID NOT NULL REFERENCES public."dbo_LC_FG_sample_day"(unload_day_id),
    gr_id INTEGER NOT NULL REFERENCES public.dbo_gear(gr_id),
    boats INTEGER NOT NULL DEFAULT 0,  -- Number of vessels
    catch NUMERIC(12, 2) NOT NULL DEFAULT 0,  -- Catch landed in kg
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment to table
COMMENT ON TABLE public.dbo_gear_unload IS 'Gear unload records with catch data';

-- Add comments to columns
COMMENT ON COLUMN public.dbo_gear_unload.unload_gr_id IS 'Primary key for gear unload record';
COMMENT ON COLUMN public.dbo_gear_unload.unload_day_id IS 'Foreign key to dbo_LC_FG_sample_day (sample day/date) - UUID type';
COMMENT ON COLUMN public.dbo_gear_unload.gr_id IS 'Foreign key to dbo_gear (gear type used)';
COMMENT ON COLUMN public.dbo_gear_unload.boats IS 'Number of vessels';
COMMENT ON COLUMN public.dbo_gear_unload.catch IS 'Catch landed in kilograms';
COMMENT ON COLUMN public.dbo_gear_unload.created_at IS 'Timestamp when record was created';
COMMENT ON COLUMN public.dbo_gear_unload.updated_at IS 'Timestamp when record was last updated';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gear_unload_day ON public.dbo_gear_unload(unload_day_id);
CREATE INDEX IF NOT EXISTS idx_gear_unload_gear ON public.dbo_gear_unload(gr_id);
CREATE INDEX IF NOT EXISTS idx_gear_unload_date ON public.dbo_gear_unload(unload_day_id);

-- Create function to update updated_at timestamp (if not already exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_dbo_gear_unload_updated_at ON public.dbo_gear_unload;
CREATE TRIGGER update_dbo_gear_unload_updated_at
    BEFORE UPDATE ON public.dbo_gear_unload
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

**Note:** If you've already created this function for other tables (like `dbo_vessel` or `dbo_gear`), you can skip this step.

---

## Step 3: Enable Row Level Security (RLS)

Enable RLS on the table:

```sql
-- Enable Row Level Security
ALTER TABLE public.dbo_gear_unload ENABLE ROW LEVEL SECURITY;
```

---

## Step 4: Create RLS Policies

Since `dbo_gear_unload` references `dbo_LC_FG_sample_day` which has a `region_id`, we'll implement region-based filtering through the sample day relationship:
- **Superadmin/Admin**: Can view and manage all gear unload records
- **Encoder**: Can view and manage gear unloads for sample days in their region only
- **Viewer**: Can view gear unloads for sample days in their region only (read-only)

```sql
-- Drop existing policies if they exist (to start fresh)
DROP POLICY IF EXISTS "RBAC Select Gear Unload" ON public.dbo_gear_unload;
DROP POLICY IF EXISTS "RBAC Insert Gear Unload" ON public.dbo_gear_unload;
DROP POLICY IF EXISTS "RBAC Update Gear Unload" ON public.dbo_gear_unload;
DROP POLICY IF EXISTS "RBAC Delete Gear Unload" ON public.dbo_gear_unload;

-- SELECT: Admins see all, Encoders/Viewers see own region (through sample day)
-- Note: "dbo_LC_FG_sample_day" must be quoted to preserve case
-- IMPORTANT: Use table alias (ur) to avoid ambiguous column reference
CREATE POLICY "RBAC Select Gear Unload" ON public.dbo_gear_unload FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.get_user_role_and_region() AS ur
    WHERE ur.role IN ('superadmin', 'admin')
  )
  OR 
  EXISTS (
    SELECT 1 FROM public."dbo_LC_FG_sample_day" sd
    INNER JOIN public.get_user_role_and_region() AS ur ON true
    WHERE sd.unload_day_id = dbo_gear_unload.unload_day_id
    AND sd.region_id = ur.region_id
  )
);

-- INSERT: Admins and Encoders (for their region through sample day)
CREATE POLICY "RBAC Insert Gear Unload" ON public.dbo_gear_unload FOR INSERT TO authenticated
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
      SELECT 1 FROM public."dbo_LC_FG_sample_day" sd
      INNER JOIN public.get_user_role_and_region() AS ur ON true
      WHERE sd.unload_day_id = dbo_gear_unload.unload_day_id
      AND sd.region_id = ur.region_id
    )
  )
);

-- UPDATE: Admins and Encoders (their region through sample day)
CREATE POLICY "RBAC Update Gear Unload" ON public.dbo_gear_unload FOR UPDATE TO authenticated
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
      SELECT 1 FROM public."dbo_LC_FG_sample_day" sd
      INNER JOIN public.get_user_role_and_region() AS ur ON true
      WHERE sd.unload_day_id = dbo_gear_unload.unload_day_id
      AND sd.region_id = ur.region_id
    )
  )
);

-- DELETE: Admins and Encoders (their region through sample day)
CREATE POLICY "RBAC Delete Gear Unload" ON public.dbo_gear_unload FOR DELETE TO authenticated
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
      SELECT 1 FROM public."dbo_LC_FG_sample_day" sd
      INNER JOIN public.get_user_role_and_region() AS ur ON true
      WHERE sd.unload_day_id = dbo_gear_unload.unload_day_id
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
AND table_name = 'dbo_gear_unload'
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
AND tc.table_name = 'dbo_gear_unload';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'dbo_gear_unload';

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
WHERE tablename = 'dbo_gear_unload';
```

---

## Step 6: Insert Sample Data (Optional)

You can insert some sample data to test:

```sql
-- First, ensure you have sample day and gear records
-- Then insert sample gear unload records
-- Note: Replace the IDs with actual values from your tables

INSERT INTO public.dbo_gear_unload (unload_day_id, gr_id, boats, catch) VALUES
    (1, 1, 5, 1250.50),
    (1, 2, 3, 850.25),
    (2, 1, 8, 2100.75),
    (2, 3, 2, 450.00)
ON CONFLICT DO NOTHING;
```

**Note:** 
- Replace `unload_day_id` values (1, 2) with actual sample day IDs from your `dbo_LC_FG_sample_day` table
- Replace `gr_id` values (1, 2, 3) with actual gear IDs from your `dbo_gear` table
- `boats` is the number of vessels (integer)
- `catch` is the catch landed in kilograms (numeric)

---

## Troubleshooting

### Error: "function public.get_user_role_and_region() does not exist"

This error means the helper function hasn't been created yet. **You must create the function BEFORE creating the RLS policies.**

Run the function creation script from **Step 2** above. The function should be created in the `public` schema (Supabase restricts access to the `auth` schema).

If you're still getting this error after creating the function:
1. Make sure you ran the function creation script successfully
2. Check that the function exists: 
   ```sql
   SELECT 
       n.nspname as schema_name,
       p.proname as function_name
   FROM pg_proc p
   JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE p.proname = 'get_user_role_and_region';
   ```
3. Verify the schema: The function should be in the `public` schema
4. Make sure all RLS policies reference `public.get_user_role_and_region()` (not `auth.get_user_role_and_region()`)

### Error: "permission denied for schema auth"

This error occurs when trying to create a function in the `auth` schema. **Solution:** Use the `public` schema instead. All the scripts in this guide use `public.get_user_role_and_region()`.

### Error: "relation dbo_LC_FG_sample_day does not exist" or "relation dbo_lc_fg_sample_day does not exist"

This error occurs because the table name in Supabase is `dbo_LC_FG_sample_day` (with capital letters), but PostgreSQL converts unquoted identifiers to lowercase.

**Solution:** Use quoted identifiers to preserve the exact case:
- Use `"dbo_LC_FG_sample_day"` (with quotes) instead of `dbo_LC_FG_sample_day` (without quotes)

All SQL scripts in this guide have been updated to use quoted table names. Make sure you've created the `dbo_LC_FG_sample_day` table first. This should already exist from the sample days setup.

### Error: "relation dbo_gear does not exist"

Make sure you've created the `dbo_gear` table first. See `docs/GEAR_TABLE_GUIDE.md`.

### Error: "column unload_gr_id does not exist"

Check the actual column name in your database. PostgreSQL converts unquoted identifiers to lowercase, so the column should be `unload_gr_id` (all lowercase). If you used quotes when creating the table, you may need to use quotes in queries as well.

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

---

## Verification Checklist

After running the scripts, verify:

- [ ] Table `dbo_gear_unload` exists
- [ ] Columns are correct: `unload_gr_id`, `unload_day_id`, `gr_id`, `boats`, `catch`, `created_at`, `updated_at`
- [ ] Foreign key constraints are created (to `dbo_LC_FG_sample_day` and `dbo_gear`)
- [ ] RLS is enabled on the table
- [ ] Policies are created (4 policies: SELECT, INSERT, UPDATE, DELETE)
- [ ] Indexes exist on `unload_day_id` and `gr_id`
- [ ] Trigger for `updated_at` is working
- [ ] Can read data as authenticated user (filtered by region for encoder/viewer)
- [ ] Can insert/update/delete as admin (all regions)
- [ ] Can insert/update/delete as encoder (own region only, through sample day)
- [ ] Cannot insert/update/delete as viewer

---

## Related Documentation

- `docs/SECURITY.md` - Security documentation including RLS policies
- `docs/RLS_POLICIES.md` - RLS policy implementation details
- `docs/GEAR_TABLE_GUIDE.md` - Gear table setup (required before gear unload table)
- `docs/DATABASE_UPDATE_GUIDE.md` - Other database update scripts

---

**Last Updated:** January 2025  
**Status:** Ready for Implementation

