# Database Update Guide: Fishing Effort Table

This guide provides SQL scripts to create the `dbo_fishing_effort` table in Supabase and set up Row Level Security (RLS) policies.

---

## Step 1: Create the Table

Run this SQL script in your Supabase SQL Editor to create the `dbo_fishing_effort` table:

```sql
-- Create dbo_fishing_effort table
-- IMPORTANT: Column names without quotes are converted to lowercase in PostgreSQL
-- So UnitEffort_ID becomes uniteffort_id
CREATE TABLE IF NOT EXISTS public.dbo_fishing_effort (
    UnitEffort_ID SERIAL PRIMARY KEY,  -- Will be stored as 'uniteffort_id' (lowercase)
    fishing_effort TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OR if you want to preserve the exact case, use quotes:
-- "UnitEffort_ID" SERIAL PRIMARY KEY,  -- Preserves exact case

-- Add comment to table
COMMENT ON TABLE public.dbo_fishing_effort IS 'Fishing effort units and measurements';

-- Add comments to columns
-- Note: Use lowercase column name if created without quotes
COMMENT ON COLUMN public.dbo_fishing_effort.uniteffort_id IS 'Primary key for fishing effort unit';
COMMENT ON COLUMN public.dbo_fishing_effort.fishing_effort IS 'Description of the fishing effort unit (e.g., Number of trips, Hours fished, etc.)';
COMMENT ON COLUMN public.dbo_fishing_effort.created_at IS 'Timestamp when record was created';
COMMENT ON COLUMN public.dbo_fishing_effort.updated_at IS 'Timestamp when record was last updated';

-- Create index on fishing_effort for faster searches
CREATE INDEX IF NOT EXISTS idx_fishing_effort_description ON public.dbo_fishing_effort(fishing_effort);

-- IMPORTANT: Column Name Case Sensitivity
-- PostgreSQL converts unquoted identifiers to lowercase.
-- So: UnitEffort_ID (without quotes) becomes uniteffort_id (all lowercase)
-- The JavaScript code uses 'uniteffort_id' to match the database.

-- Check your actual column name:
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'dbo_fishing_effort';

-- If you want to rename it to preserve case (optional):
-- ALTER TABLE public.dbo_fishing_effort RENAME COLUMN uniteffort_id TO "UnitEffort_ID";
-- Then update JavaScript to use "UnitEffort_ID" (with quotes in queries if needed)

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_dbo_fishing_effort_updated_at
    BEFORE UPDATE ON public.dbo_fishing_effort
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## Step 2: Enable Row Level Security (RLS)

Enable RLS on the table:

```sql
-- Enable Row Level Security
ALTER TABLE public.dbo_fishing_effort ENABLE ROW LEVEL SECURITY;
```

---

## Step 3: Create RLS Policies

Since `dbo_fishing_effort` is a reference/lookup table (similar to regions), we'll allow all authenticated users to read it, but only admins can modify it.

```sql
-- Drop existing policies if they exist (to start fresh)
DROP POLICY IF EXISTS "Allow authenticated users to read fishing effort" ON public.dbo_fishing_effort;
DROP POLICY IF EXISTS "Allow admins to insert fishing effort" ON public.dbo_fishing_effort;
DROP POLICY IF EXISTS "Allow admins to update fishing effort" ON public.dbo_fishing_effort;
DROP POLICY IF EXISTS "Allow admins to delete fishing effort" ON public.dbo_fishing_effort;

-- SELECT: Allow all authenticated users to read (needed for dropdowns and displays)
CREATE POLICY "Allow authenticated users to read fishing effort" 
ON public.dbo_fishing_effort 
FOR SELECT 
TO authenticated 
USING (true);

-- INSERT: Allow only Admins and Superadmins to insert
CREATE POLICY "Allow admins to insert fishing effort" 
ON public.dbo_fishing_effort 
FOR INSERT 
TO authenticated 
WITH CHECK (is_admin());

-- UPDATE: Allow only Admins and Superadmins to update
CREATE POLICY "Allow admins to update fishing effort" 
ON public.dbo_fishing_effort 
FOR UPDATE 
TO authenticated 
USING (is_admin());

-- DELETE: Allow only Admins and Superadmins to delete
CREATE POLICY "Allow admins to delete fishing effort" 
ON public.dbo_fishing_effort 
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
AND table_name = 'dbo_fishing_effort'
ORDER BY ordinal_position;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'dbo_fishing_effort';

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
WHERE tablename = 'dbo_fishing_effort';
```

---

## Step 5: Insert Sample Data (Optional)

You can insert some sample data to test:

```sql
-- Insert sample fishing effort units
INSERT INTO public.dbo_fishing_effort (fishing_effort) VALUES
    ('Number of trips'),
    ('Hours fished'),
    ('Days fished'),
    ('Number of vessels'),
    ('Number of gears'),
    ('Crew size')
ON CONFLICT DO NOTHING;
```

---

## Alternative: If Region-Based Filtering is Needed

If you later decide that fishing effort should be region-specific, you would need to:

1. **Add region_id column:**
```sql
ALTER TABLE public.dbo_fishing_effort 
ADD COLUMN IF NOT EXISTS region_id INTEGER REFERENCES public.dbo_region(region_id);
```

2. **Update RLS policies to include region filtering:**
```sql
-- Drop old policies
DROP POLICY IF EXISTS "Allow authenticated users to read fishing effort" ON public.dbo_fishing_effort;
DROP POLICY IF EXISTS "Allow admins to insert fishing effort" ON public.dbo_fishing_effort;
DROP POLICY IF EXISTS "Allow admins to update fishing effort" ON public.dbo_fishing_effort;
DROP POLICY IF EXISTS "Allow admins to delete fishing effort" ON public.dbo_fishing_effort;

-- SELECT: Admins see all, Encoders/Viewers see own region
CREATE POLICY "RBAC Select FE" ON public.dbo_fishing_effort FOR SELECT TO authenticated
USING (
  (SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin') 
  OR 
  region_id = (SELECT region_id FROM auth.get_user_role_and_region())
);

-- INSERT: Admins and Encoders (for their region)
CREATE POLICY "RBAC Insert FE" ON public.dbo_fishing_effort FOR INSERT TO authenticated
WITH CHECK (
  ((SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin'))
  OR 
  ((SELECT role FROM auth.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM auth.get_user_role_and_region()))
);

-- UPDATE: Admins and Encoders (their region)
CREATE POLICY "RBAC Update FE" ON public.dbo_fishing_effort FOR UPDATE TO authenticated
USING (
  ((SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin'))
  OR 
  ((SELECT role FROM auth.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM auth.get_user_role_and_region()))
);

-- DELETE: Admins and Encoders (their region)
CREATE POLICY "RBAC Delete FE" ON public.dbo_fishing_effort FOR DELETE TO authenticated
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

### Error: "relation auth.get_user_role_and_region() does not exist"

If you need region-based filtering and get this error, create the function:

```sql
CREATE OR REPLACE FUNCTION auth.get_user_role_and_region()
RETURNS TABLE (role text, region_id int) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT role, region_id FROM public.dbo_user WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql;
```

---

## Verification Checklist

After running the scripts, verify:

- [ ] Table `dbo_fishing_effort` exists
- [ ] Columns are correct: `UnitEffort_ID`, `fishing_effort`, `created_at`, `updated_at`
- [ ] RLS is enabled on the table
- [ ] Policies are created (4 policies: SELECT, INSERT, UPDATE, DELETE)
- [ ] Index on `fishing_effort` column exists
- [ ] Trigger for `updated_at` is working
- [ ] Can read data as authenticated user
- [ ] Can insert/update/delete as admin
- [ ] Cannot insert/update/delete as viewer or encoder (if using basic policies)

---

## Related Documentation

- `docs/SECURITY.md` - Security documentation including RLS policies
- `docs/RLS_POLICIES.md` - RLS policy implementation details
- `docs/DATABASE_UPDATE_GUIDE.md` - Other database update scripts

---

**Last Updated:** January 2025  
**Status:** Ready for Implementation

