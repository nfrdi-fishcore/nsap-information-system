# Database Update Guide: Gear Table

This guide provides SQL scripts to create the `dbo_gear` table in Supabase and set up Row Level Security (RLS) policies.

---

## Step 1: Create the Table

Run this SQL script in your Supabase SQL Editor to create the `dbo_gear` table:

```sql
-- Create dbo_gear table
-- IMPORTANT: Column names without quotes are converted to lowercase in PostgreSQL
CREATE TABLE IF NOT EXISTS public.dbo_gear (
    gr_id SERIAL PRIMARY KEY,  -- Will be stored as 'gr_id' (lowercase)
    gear_desc TEXT NOT NULL,
    uniteffort_id INTEGER NOT NULL REFERENCES public.dbo_fishing_effort(uniteffort_id),
    uniteffort_2_id INTEGER REFERENCES public.dbo_fishing_effort(uniteffort_id),
    uniteffort_3_id INTEGER REFERENCES public.dbo_fishing_effort(uniteffort_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment to table
COMMENT ON TABLE public.dbo_gear IS 'Fishing gear types and their associated effort units';

-- Add comments to columns
COMMENT ON COLUMN public.dbo_gear.gr_id IS 'Primary key for gear';
COMMENT ON COLUMN public.dbo_gear.gear_desc IS 'Description of the fishing gear (e.g., Gill Net, Trawl Net, etc.)';
COMMENT ON COLUMN public.dbo_gear.uniteffort_id IS 'Primary fishing effort unit (required, foreign key to dbo_fishing_effort)';
COMMENT ON COLUMN public.dbo_gear.uniteffort_2_id IS 'Secondary fishing effort unit (optional, foreign key to dbo_fishing_effort)';
COMMENT ON COLUMN public.dbo_gear.uniteffort_3_id IS 'Tertiary fishing effort unit (optional, foreign key to dbo_fishing_effort)';
COMMENT ON COLUMN public.dbo_gear.created_at IS 'Timestamp when record was created';
COMMENT ON COLUMN public.dbo_gear.updated_at IS 'Timestamp when record was last updated';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gear_description ON public.dbo_gear(gear_desc);
CREATE INDEX IF NOT EXISTS idx_gear_uniteffort ON public.dbo_gear(uniteffort_id);
CREATE INDEX IF NOT EXISTS idx_gear_uniteffort_2 ON public.dbo_gear(uniteffort_2_id);
CREATE INDEX IF NOT EXISTS idx_gear_uniteffort_3 ON public.dbo_gear(uniteffort_3_id);

-- Create function to update updated_at timestamp (if not already exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_dbo_gear_updated_at ON public.dbo_gear;
CREATE TRIGGER update_dbo_gear_updated_at
    BEFORE UPDATE ON public.dbo_gear
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## Step 2: Enable Row Level Security (RLS)

Enable RLS on the table:

```sql
-- Enable Row Level Security
ALTER TABLE public.dbo_gear ENABLE ROW LEVEL SECURITY;
```

---

## Step 3: Create RLS Policies

Since `dbo_gear` is a reference/lookup table (similar to fishing effort), we'll allow all authenticated users to read it, but only admins can modify it.

```sql
-- Drop existing policies if they exist (to start fresh)
DROP POLICY IF EXISTS "Allow authenticated users to read gear" ON public.dbo_gear;
DROP POLICY IF EXISTS "Allow admins to insert gear" ON public.dbo_gear;
DROP POLICY IF EXISTS "Allow admins to update gear" ON public.dbo_gear;
DROP POLICY IF EXISTS "Allow admins to delete gear" ON public.dbo_gear;

-- SELECT: Allow all authenticated users to read (needed for dropdowns and displays)
CREATE POLICY "Allow authenticated users to read gear" 
ON public.dbo_gear 
FOR SELECT 
TO authenticated 
USING (true);

-- INSERT: Allow only Admins and Superadmins to insert
CREATE POLICY "Allow admins to insert gear" 
ON public.dbo_gear 
FOR INSERT 
TO authenticated 
WITH CHECK (is_admin());

-- UPDATE: Allow only Admins and Superadmins to update
CREATE POLICY "Allow admins to update gear" 
ON public.dbo_gear 
FOR UPDATE 
TO authenticated 
USING (is_admin());

-- DELETE: Allow only Admins and Superadmins to delete
CREATE POLICY "Allow admins to delete gear" 
ON public.dbo_gear 
FOR DELETE 
TO authenticated 
USING (is_admin());
```

**Note:** The `is_admin()` function should already exist from the user management RLS setup. If it doesn't exist, you'll need to create it first (see `docs/RLS_POLICIES.md`).

---

## Step 4: Verify the Table

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
AND table_name = 'dbo_gear'
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
AND tc.table_name = 'dbo_gear';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'dbo_gear';

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
WHERE tablename = 'dbo_gear';
```

---

## Step 5: Insert Sample Data (Optional)

You can insert some sample data to test:

```sql
-- First, ensure you have fishing effort records
-- Then insert sample gear records
INSERT INTO public.dbo_gear (gear_desc, uniteffort_id, uniteffort_2_id, uniteffort_3_id) VALUES
    ('Gill Net', 1, NULL, NULL),
    ('Trawl Net', 1, 2, NULL),
    ('Hook and Line', 3, NULL, NULL),
    ('Longline', 1, 2, 3)
ON CONFLICT DO NOTHING;
```

**Note:** Replace the `uniteffort_id` values (1, 2, 3) with actual IDs from your `dbo_fishing_effort` table.

---

## Alternative: If Region-Based Filtering is Needed

If you later decide that gear should be region-specific, you would need to:

1. **Add region_id column:**
```sql
ALTER TABLE public.dbo_gear 
ADD COLUMN IF NOT EXISTS region_id INTEGER REFERENCES public.dbo_region(region_id);
```

2. **Update RLS policies to include region filtering:**
```sql
-- Drop old policies
DROP POLICY IF EXISTS "Allow authenticated users to read gear" ON public.dbo_gear;
DROP POLICY IF EXISTS "Allow admins to insert gear" ON public.dbo_gear;
DROP POLICY IF EXISTS "Allow admins to update gear" ON public.dbo_gear;
DROP POLICY IF EXISTS "Allow admins to delete gear" ON public.dbo_gear;

-- SELECT: Admins see all, Encoders/Viewers see own region
CREATE POLICY "RBAC Select Gear" ON public.dbo_gear FOR SELECT TO authenticated
USING (
  (SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin') 
  OR 
  region_id = (SELECT region_id FROM auth.get_user_role_and_region())
);

-- INSERT: Admins and Encoders (for their region)
CREATE POLICY "RBAC Insert Gear" ON public.dbo_gear FOR INSERT TO authenticated
WITH CHECK (
  ((SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin'))
  OR 
  ((SELECT role FROM auth.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM auth.get_user_role_and_region()))
);

-- UPDATE: Admins and Encoders (their region)
CREATE POLICY "RBAC Update Gear" ON public.dbo_gear FOR UPDATE TO authenticated
USING (
  ((SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin'))
  OR 
  ((SELECT role FROM auth.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM auth.get_user_role_and_region()))
);

-- DELETE: Admins and Encoders (their region)
CREATE POLICY "RBAC Delete Gear" ON public.dbo_gear FOR DELETE TO authenticated
USING (
  ((SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin'))
  OR 
  ((SELECT role FROM auth.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM auth.get_user_role_and_region()))
);
```

---

## Troubleshooting

### Error: "function is_admin() does not exist"

If you get this error, you need to create the `is_admin()` function first. Run this:

```sql
CREATE OR REPLACE FUNCTION is_admin() 
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM dbo_user 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  );
END;
$$;
```

### Error: "relation dbo_fishing_effort does not exist"

Make sure you've created the `dbo_fishing_effort` table first. See `docs/FISHING_EFFORT_TABLE_GUIDE.md`.

### Error: "column uniteffort_id does not exist in dbo_fishing_effort"

Check the actual column name in `dbo_fishing_effort`. It might be `uniteffort_id` (lowercase) or `UnitEffort_ID` (with quotes). Update the foreign key reference accordingly.

---

## Verification Checklist

After running the scripts, verify:

- [ ] Table `dbo_gear` exists
- [ ] Columns are correct: `gr_id`, `gear_desc`, `uniteffort_id`, `uniteffort_2_id`, `uniteffort_3_id`, `created_at`, `updated_at`
- [ ] Foreign key constraints are created (to `dbo_fishing_effort`)
- [ ] RLS is enabled on the table
- [ ] Policies are created (4 policies: SELECT, INSERT, UPDATE, DELETE)
- [ ] Indexes exist on `gear_desc` and fishing effort columns
- [ ] Trigger for `updated_at` is working
- [ ] Can read data as authenticated user
- [ ] Can insert/update/delete as admin
- [ ] Cannot insert/update/delete as viewer or encoder (if using basic policies)

---

## Related Documentation

- `docs/SECURITY.md` - Security documentation including RLS policies
- `docs/RLS_POLICIES.md` - RLS policy implementation details
- `docs/FISHING_EFFORT_TABLE_GUIDE.md` - Fishing effort table setup (required before gear table)
- `docs/DATABASE_UPDATE_GUIDE.md` - Other database update scripts

---

**Last Updated:** January 2025  
**Status:** Ready for Implementation

