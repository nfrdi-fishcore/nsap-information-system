# Database Update Guide: Sample Lengths Table

This guide provides SQL scripts to create the `dbo_sample_lengths` table in Supabase and set up Row Level Security (RLS) policies.

**Prerequisites:**
- The `dbo_vessel_catch` table must exist (see `docs/VESSEL_CATCH_TABLE_GUIDE.md`)
- The `public.get_user_role_and_region()` function should exist (will be created in Step 2 if it doesn't)

---

## Step 1: Create the Table

Run this SQL script in your Supabase SQL Editor to create the `dbo_sample_lengths` table:

```sql
-- Create dbo_sample_lengths table
-- IMPORTANT: Column names without quotes are converted to lowercase in PostgreSQL
CREATE TABLE IF NOT EXISTS public.dbo_sample_lengths (
    length_id SERIAL PRIMARY KEY,  -- Will be stored as 'length_id' (lowercase)
    catch_id INTEGER NOT NULL REFERENCES public.dbo_vessel_catch(catch_id),
    len NUMERIC(12, 2) NOT NULL,  -- Length measurement
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment to table
COMMENT ON TABLE public.dbo_sample_lengths IS 'Sample length measurements for vessel catches';

-- Add comments to columns
COMMENT ON COLUMN public.dbo_sample_lengths.length_id IS 'Primary key for sample length record';
COMMENT ON COLUMN public.dbo_sample_lengths.catch_id IS 'Foreign key to dbo_vessel_catch';
COMMENT ON COLUMN public.dbo_sample_lengths.len IS 'Length measurement value';
COMMENT ON COLUMN public.dbo_sample_lengths.created_at IS 'Timestamp when record was created';
COMMENT ON COLUMN public.dbo_sample_lengths.updated_at IS 'Timestamp when record was last updated';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sample_lengths_catch ON public.dbo_sample_lengths(catch_id);

-- Create function to update updated_at timestamp (if not already exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_dbo_sample_lengths_updated_at ON public.dbo_sample_lengths;
CREATE TRIGGER update_dbo_sample_lengths_updated_at
    BEFORE UPDATE ON public.dbo_sample_lengths
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

**Note:** If you've already created this function for other tables (like `dbo_vessel_catch` or `dbo_vessel_unload`), you can skip this step.

---

## Step 3: Enable Row Level Security (RLS)

Enable RLS on the table:

```sql
-- Enable Row Level Security
ALTER TABLE public.dbo_sample_lengths ENABLE ROW LEVEL SECURITY;
```

---

## Step 4: Create RLS Policies

Since `dbo_sample_lengths` references `dbo_vessel_catch` which references `dbo_vessel_unload` which references `dbo_gear_unload` which references `dbo_LC_FG_sample_day` (which has `region_id`), we'll implement region-based filtering through the sample lengths -> vessel catch -> vessel unload -> gear unload -> sample day relationship:
- **Superadmin/Admin**: Can view and manage all sample length records
- **Encoder**: Can view and manage sample lengths for vessel catches in their region only
- **Viewer**: Can view sample lengths for vessel catches in their region only (read-only)

```sql
-- Drop existing policies if they exist (to start fresh)
DROP POLICY IF EXISTS "RBAC Select Sample Lengths" ON public.dbo_sample_lengths;
DROP POLICY IF EXISTS "RBAC Insert Sample Lengths" ON public.dbo_sample_lengths;
DROP POLICY IF EXISTS "RBAC Update Sample Lengths" ON public.dbo_sample_lengths;
DROP POLICY IF EXISTS "RBAC Delete Sample Lengths" ON public.dbo_sample_lengths;

-- SELECT: Admins see all, Encoders/Viewers see own region (through vessel catch -> vessel unload -> gear unload -> sample day)
-- Note: "dbo_LC_FG_sample_day" must be quoted to preserve case
-- IMPORTANT: Use table alias (ur) to avoid ambiguous column reference
CREATE POLICY "RBAC Select Sample Lengths" ON public.dbo_sample_lengths FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.get_user_role_and_region() AS ur
    WHERE ur.role IN ('superadmin', 'admin')
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.dbo_vessel_catch vc
    INNER JOIN public.dbo_vessel_unload vu ON vu.v_unload_id = vc.v_unload_id
    INNER JOIN public.dbo_gear_unload gu ON gu.unload_gr_id = vu.unload_gr_id
    INNER JOIN public."dbo_LC_FG_sample_day" sd ON sd.unload_day_id = gu.unload_day_id
    INNER JOIN public.get_user_role_and_region() AS ur ON true
    WHERE vc.catch_id = dbo_sample_lengths.catch_id
    AND sd.region_id = ur.region_id
  )
);

-- INSERT: Admins and Encoders (for their region through vessel catch -> vessel unload -> gear unload -> sample day)
CREATE POLICY "RBAC Insert Sample Lengths" ON public.dbo_sample_lengths FOR INSERT TO authenticated
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
      SELECT 1 FROM public.dbo_vessel_catch vc
      INNER JOIN public.dbo_vessel_unload vu ON vu.v_unload_id = vc.v_unload_id
      INNER JOIN public.dbo_gear_unload gu ON gu.unload_gr_id = vu.unload_gr_id
      INNER JOIN public."dbo_LC_FG_sample_day" sd ON sd.unload_day_id = gu.unload_day_id
      INNER JOIN public.get_user_role_and_region() AS ur ON true
      WHERE vc.catch_id = dbo_sample_lengths.catch_id
      AND sd.region_id = ur.region_id
    )
  )
);

-- UPDATE: Admins and Encoders (their region through vessel catch -> vessel unload -> gear unload -> sample day)
CREATE POLICY "RBAC Update Sample Lengths" ON public.dbo_sample_lengths FOR UPDATE TO authenticated
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
      SELECT 1 FROM public.dbo_vessel_catch vc
      INNER JOIN public.dbo_vessel_unload vu ON vu.v_unload_id = vc.v_unload_id
      INNER JOIN public.dbo_gear_unload gu ON gu.unload_gr_id = vu.unload_gr_id
      INNER JOIN public."dbo_LC_FG_sample_day" sd ON sd.unload_day_id = gu.unload_day_id
      INNER JOIN public.get_user_role_and_region() AS ur ON true
      WHERE vc.catch_id = dbo_sample_lengths.catch_id
      AND sd.region_id = ur.region_id
    )
  )
);

-- DELETE: Admins and Encoders (their region through vessel catch -> vessel unload -> gear unload -> sample day)
CREATE POLICY "RBAC Delete Sample Lengths" ON public.dbo_sample_lengths FOR DELETE TO authenticated
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
      SELECT 1 FROM public.dbo_vessel_catch vc
      INNER JOIN public.dbo_vessel_unload vu ON vu.v_unload_id = vc.v_unload_id
      INNER JOIN public.dbo_gear_unload gu ON gu.unload_gr_id = vu.unload_gr_id
      INNER JOIN public."dbo_LC_FG_sample_day" sd ON sd.unload_day_id = gu.unload_day_id
      INNER JOIN public.get_user_role_and_region() AS ur ON true
      WHERE vc.catch_id = dbo_sample_lengths.catch_id
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
AND table_name = 'dbo_sample_lengths'
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
AND tc.table_name = 'dbo_sample_lengths';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'dbo_sample_lengths';

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
WHERE tablename = 'dbo_sample_lengths';
```

---

## Step 6: Insert Sample Data (Optional)

You can insert some sample data to test:

```sql
-- First, ensure you have vessel catch records
-- Then insert sample length records
-- Note: Replace the IDs with actual values from your tables

INSERT INTO public.dbo_sample_lengths (catch_id, len) VALUES
    (1, 25.5),
    (1, 26.0),
    (1, 27.2),
    (2, 30.0),
    (2, 31.5),
    (3, 20.8)
ON CONFLICT DO NOTHING;
```

**Note:** 
- Replace `catch_id` values (1, 2, 3) with actual vessel catch IDs from your `dbo_vessel_catch` table
- `len` is the length measurement value

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

### Error: "relation dbo_vessel_catch does not exist"

Make sure you've created the `dbo_vessel_catch` table first. See `docs/VESSEL_CATCH_TABLE_GUIDE.md`.

### Error: "column length_id does not exist"

Check the actual column name in your database. PostgreSQL converts unquoted identifiers to lowercase, so the column should be `length_id` (all lowercase). If you used quotes when creating the table, you may need to use quotes in queries as well.

---

## Verification Checklist

After running the scripts, verify:

- [ ] Table `dbo_sample_lengths` exists
- [ ] Columns are correct: `length_id`, `catch_id`, `len`, `created_at`, `updated_at`
- [ ] Foreign key constraints are created (to `dbo_vessel_catch`)
- [ ] RLS is enabled on the table
- [ ] Policies are created (4 policies: SELECT, INSERT, UPDATE, DELETE)
- [ ] Indexes exist on `catch_id`
- [ ] Trigger for `updated_at` is working
- [ ] Can read data as authenticated user (filtered by region for encoder/viewer)
- [ ] Can insert/update/delete as admin (all regions)
- [ ] Can insert/update/delete as encoder (own region only, through vessel catch -> vessel unload -> gear unload -> sample day)
- [ ] Cannot insert/update/delete as viewer

---

## Related Documentation

- `docs/SECURITY.md` - Security documentation including RLS policies
- `docs/RLS_POLICIES.md` - RLS policy implementation details
- `docs/VESSEL_CATCH_TABLE_GUIDE.md` - Vessel catch table setup (required before sample lengths table)
- `docs/DATABASE_UPDATE_GUIDE.md` - Other database update scripts

---

**Last Updated:** January 2025  
**Status:** Ready for Implementation

