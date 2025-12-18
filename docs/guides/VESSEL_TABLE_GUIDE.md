# Database Update Guide: Vessel Table

This guide provides SQL scripts to create the `dbo_vessel` table in Supabase and set up Row Level Security (RLS) policies.

---

## Step 1: Create the Table

Run this SQL script in your Supabase SQL Editor to create the `dbo_vessel` table:

```sql
-- Create dbo_vessel table
-- IMPORTANT: Column names without quotes are converted to lowercase in PostgreSQL
CREATE TABLE IF NOT EXISTS public.dbo_vessel (
    boat_id SERIAL PRIMARY KEY,  -- Will be stored as 'boat_id' (lowercase)
    vesselname TEXT NOT NULL,
    gr_id INTEGER NOT NULL REFERENCES public.dbo_gear(gr_id),
    region_id INTEGER NOT NULL REFERENCES public.dbo_region(region_id),
    length NUMERIC(10, 2) NOT NULL,
    width NUMERIC(10, 2) NOT NULL,
    depth NUMERIC(10, 2) NOT NULL,
    grt NUMERIC(10, 2),  -- Gross Tonnage (can be auto-calculated)
    hpw NUMERIC(10, 2),  -- Horsepower
    engine_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment to table
COMMENT ON TABLE public.dbo_vessel IS 'Fishing vessels and their specifications';

-- Add comments to columns
COMMENT ON COLUMN public.dbo_vessel.boat_id IS 'Primary key for vessel';
COMMENT ON COLUMN public.dbo_vessel.vesselname IS 'Name of the vessel';
COMMENT ON COLUMN public.dbo_vessel.gr_id IS 'Foreign key to dbo_gear (gear type used by vessel)';
COMMENT ON COLUMN public.dbo_vessel.region_id IS 'Foreign key to dbo_region (region where vessel operates)';
COMMENT ON COLUMN public.dbo_vessel.length IS 'Vessel length in meters';
COMMENT ON COLUMN public.dbo_vessel.width IS 'Vessel width in meters';
COMMENT ON COLUMN public.dbo_vessel.depth IS 'Vessel depth in meters';
COMMENT ON COLUMN public.dbo_vessel.grt IS 'Gross Tonnage - calculated as (Length × Width × Depth × 0.70) ÷ 2.83';
COMMENT ON COLUMN public.dbo_vessel.hpw IS 'Horsepower of the engine';
COMMENT ON COLUMN public.dbo_vessel.engine_type IS 'Type of engine (e.g., Diesel, Gasoline, Electric)';
COMMENT ON COLUMN public.dbo_vessel.created_at IS 'Timestamp when record was created';
COMMENT ON COLUMN public.dbo_vessel.updated_at IS 'Timestamp when record was last updated';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vessel_name ON public.dbo_vessel(vesselname);
CREATE INDEX IF NOT EXISTS idx_vessel_gear ON public.dbo_vessel(gr_id);
CREATE INDEX IF NOT EXISTS idx_vessel_region ON public.dbo_vessel(region_id);

-- Create function to update updated_at timestamp (if not already exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_dbo_vessel_updated_at ON public.dbo_vessel;
CREATE TRIGGER update_dbo_vessel_updated_at
    BEFORE UPDATE ON public.dbo_vessel
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

**Note:** The GRT (Gross Tonnage) can be calculated automatically using the formula: `(Length × Width × Depth × 0.70) ÷ 2.83`. The application will calculate this automatically when length, width, and depth are entered, but you can also store it in the database.

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

**Note:** If you've already created this function for other tables (like `dbo_fishing_ground` or `dbo_landing_center`), you can skip this step.

---

## Step 3: Enable Row Level Security (RLS)

Enable RLS on the table:

```sql
-- Enable Row Level Security
ALTER TABLE public.dbo_vessel ENABLE ROW LEVEL SECURITY;
```

---

## Step 4: Create RLS Policies

Since `dbo_vessel` has a `region_id` column, we'll implement region-based filtering:
- **Superadmin/Admin**: Can view and manage all vessels
- **Encoder**: Can view and manage vessels in their region only
- **Viewer**: Can view vessels in their region only (read-only)

```sql
-- Drop existing policies if they exist (to start fresh)
DROP POLICY IF EXISTS "RBAC Select Vessel" ON public.dbo_vessel;
DROP POLICY IF EXISTS "RBAC Insert Vessel" ON public.dbo_vessel;
DROP POLICY IF EXISTS "RBAC Update Vessel" ON public.dbo_vessel;
DROP POLICY IF EXISTS "RBAC Delete Vessel" ON public.dbo_vessel;

-- SELECT: Admins see all, Encoders/Viewers see own region
-- IMPORTANT: Use table alias (ur) to avoid ambiguous column reference
CREATE POLICY "RBAC Select Vessel" ON public.dbo_vessel FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.get_user_role_and_region() AS ur
    WHERE ur.role IN ('superadmin', 'admin')
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.get_user_role_and_region() AS ur
    WHERE dbo_vessel.region_id = ur.region_id
  )
);

-- INSERT: Admins and Encoders (for their region)
CREATE POLICY "RBAC Insert Vessel" ON public.dbo_vessel FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.get_user_role_and_region() AS ur
    WHERE ur.role IN ('superadmin', 'admin')
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.get_user_role_and_region() AS ur
    WHERE ur.role = 'encoder' AND dbo_vessel.region_id = ur.region_id
  )
);

-- UPDATE: Admins and Encoders (their region)
CREATE POLICY "RBAC Update Vessel" ON public.dbo_vessel FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.get_user_role_and_region() AS ur
    WHERE ur.role IN ('superadmin', 'admin')
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.get_user_role_and_region() AS ur
    WHERE ur.role = 'encoder' AND dbo_vessel.region_id = ur.region_id
  )
);

-- DELETE: Admins and Encoders (their region)
CREATE POLICY "RBAC Delete Vessel" ON public.dbo_vessel FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.get_user_role_and_region() AS ur
    WHERE ur.role IN ('superadmin', 'admin')
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.get_user_role_and_region() AS ur
    WHERE ur.role = 'encoder' AND dbo_vessel.region_id = ur.region_id
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
AND table_name = 'dbo_vessel'
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
AND tc.table_name = 'dbo_vessel';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'dbo_vessel';

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
WHERE tablename = 'dbo_vessel';
```

---

## Step 6: Insert Sample Data (Optional)

You can insert some sample data to test:

```sql
-- First, ensure you have gear and region records
-- Then insert sample vessel records
-- Note: Replace the IDs with actual values from your tables

INSERT INTO public.dbo_vessel (vesselname, gr_id, region_id, length, width, depth, grt, hpw, engine_type) VALUES
    ('MV Fishing Boat 1', 1, 1, 10.5, 3.2, 1.8, 8.35, 150.0, 'Diesel'),
    ('MV Fishing Boat 2', 2, 1, 12.0, 3.5, 2.0, 10.39, 200.0, 'Diesel'),
    ('MV Fishing Boat 3', 1, 2, 8.5, 2.8, 1.5, 5.05, 100.0, 'Gasoline')
ON CONFLICT DO NOTHING;
```

**Note:** 
- Replace `gr_id` values (1, 2) with actual gear IDs from your `dbo_gear` table
- Replace `region_id` values (1, 2) with actual region IDs from your `dbo_region` table
- The GRT values are calculated using the formula: `(Length × Width × Depth × 0.70) ÷ 2.83`

---

## GRT Calculation Formula

The Gross Tonnage (GRT) is calculated automatically in the application using the following formula:

```
GRT = (Length × Width × Depth × 0.70) ÷ 2.83
```

Where:
- **Length**: Vessel length in meters
- **Width**: Vessel width in meters
- **Depth**: Vessel depth in meters
- **0.70**: Conversion factor
- **2.83**: Conversion factor (cubic meters to gross tonnage)

**Example:**
- Length: 10.5 m
- Width: 3.2 m
- Depth: 1.8 m
- GRT = (10.5 × 3.2 × 1.8 × 0.70) ÷ 2.83 = 42.336 ÷ 2.83 ≈ 14.96 GRT

---

## Troubleshooting

### Error: "function auth.get_user_role_and_region() does not exist"

This error means the helper function hasn't been created yet. **You must create the function BEFORE creating the RLS policies.**

Run the function creation script from **Step 2** above. The function should be created in the `auth` schema (or `public` schema if you prefer, but then you'll need to update all policy references).

If you're still getting this error after creating the function:
1. Make sure you ran the function creation script successfully
2. Check that the function exists: `SELECT * FROM pg_proc WHERE proname = 'get_user_role_and_region';`
3. Verify the schema: The function should be in the `auth` schema, not `public`
4. If the function is in a different schema, update the RLS policies to reference the correct schema

### Error: "relation dbo_gear does not exist"

Make sure you've created the `dbo_gear` table first. See `docs/GEAR_TABLE_GUIDE.md`.

### Error: "relation dbo_region does not exist"

Make sure you've created the `dbo_region` table first. This should already exist from the initial setup.

### Error: "column boat_id does not exist"

Check the actual column name in your database. PostgreSQL converts unquoted identifiers to lowercase, so the column should be `boat_id` (all lowercase). If you used quotes when creating the table, you may need to use quotes in queries as well.

---

## Verification Checklist

After running the scripts, verify:

- [ ] Table `dbo_vessel` exists
- [ ] Columns are correct: `boat_id`, `vesselname`, `gr_id`, `region_id`, `length`, `width`, `depth`, `grt`, `hpw`, `engine_type`, `created_at`, `updated_at`
- [ ] Foreign key constraints are created (to `dbo_gear` and `dbo_region`)
- [ ] RLS is enabled on the table
- [ ] Policies are created (4 policies: SELECT, INSERT, UPDATE, DELETE)
- [ ] Indexes exist on `vesselname`, `gr_id`, and `region_id`
- [ ] Trigger for `updated_at` is working
- [ ] Can read data as authenticated user (filtered by region for encoder/viewer)
- [ ] Can insert/update/delete as admin (all regions)
- [ ] Can insert/update/delete as encoder (own region only)
- [ ] Cannot insert/update/delete as viewer
- [ ] GRT calculation works correctly in the application

---

## Related Documentation

- `docs/SECURITY.md` - Security documentation including RLS policies
- `docs/RLS_POLICIES.md` - RLS policy implementation details
- `docs/GEAR_TABLE_GUIDE.md` - Gear table setup (required before vessel table)
- `docs/DATABASE_UPDATE_GUIDE.md` - Other database update scripts

---

**Last Updated:** January 2025  
**Status:** Ready for Implementation

