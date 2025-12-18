# Database Update Guide: Species Table

This guide provides SQL scripts to create the `dbo_species` table in Supabase and set up Row Level Security (RLS) policies.

**Prerequisites:**
- The `is_admin()` function should exist (will be created in Step 2 if it doesn't)

---

## Step 1: Create the Table

Run this SQL script in your Supabase SQL Editor to create the `dbo_species` table:

```sql
-- Create dbo_species table
-- IMPORTANT: Column names without quotes are converted to lowercase in PostgreSQL
CREATE TABLE IF NOT EXISTS public.dbo_species (
    species_id SERIAL PRIMARY KEY,  -- Will be stored as 'species_id' (lowercase)
    sp_name TEXT NOT NULL,  -- Species name
    sp_family TEXT,  -- Species family
    sp_sci TEXT,  -- Species scientific name
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment to table
COMMENT ON TABLE public.dbo_species IS 'Fish species information including common name, family, and scientific name';

-- Add comments to columns
COMMENT ON COLUMN public.dbo_species.species_id IS 'Primary key for species';
COMMENT ON COLUMN public.dbo_species.sp_name IS 'Common name of the species';
COMMENT ON COLUMN public.dbo_species.sp_family IS 'Family classification of the species';
COMMENT ON COLUMN public.dbo_species.sp_sci IS 'Scientific name of the species (binomial nomenclature)';
COMMENT ON COLUMN public.dbo_species.created_at IS 'Timestamp when record was created';
COMMENT ON COLUMN public.dbo_species.updated_at IS 'Timestamp when record was last updated';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_species_name ON public.dbo_species(sp_name);
CREATE INDEX IF NOT EXISTS idx_species_family ON public.dbo_species(sp_family);
CREATE INDEX IF NOT EXISTS idx_species_scientific ON public.dbo_species(sp_sci);

-- Create function to update updated_at timestamp (if not already exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_dbo_species_updated_at ON public.dbo_species;
CREATE TRIGGER update_dbo_species_updated_at
    BEFORE UPDATE ON public.dbo_species
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## Step 2: Create Helper Function (Required for RLS)

**IMPORTANT:** Before creating RLS policies, you must create the helper function `is_admin()`. This function is used by RLS policies to check if a user is an admin or superadmin.

If this function doesn't exist yet, run this script:

```sql
-- Create helper function to check if user is admin or superadmin
-- This function is used by RLS policies for admin-only operations
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.dbo_user u
    WHERE u.user_id = auth.uid()
    AND u.role IN ('superadmin', 'admin')
  );
END;
$$;
```

**Note:** If you've already created this function for other tables (like `dbo_fishing_effort`), you can skip this step.

---

## Step 3: Enable Row Level Security (RLS)

Enable RLS on the table:

```sql
-- Enable Row Level Security
ALTER TABLE public.dbo_species ENABLE ROW LEVEL SECURITY;
```

---

## Step 4: Create RLS Policies

Since `dbo_species` is a reference/master data table (like `dbo_fishing_effort`), it doesn't need region-based filtering. All authenticated users can view species, but only admins can modify:
- **All Authenticated Users**: Can view all species (read-only for encoders/viewers)
- **Superadmin/Admin**: Can view, create, update, and delete species

```sql
-- Drop existing policies if they exist (to start fresh)
DROP POLICY IF EXISTS "Allow authenticated users to read species" ON public.dbo_species;
DROP POLICY IF EXISTS "Allow admins to insert species" ON public.dbo_species;
DROP POLICY IF EXISTS "Allow admins to update species" ON public.dbo_species;
DROP POLICY IF EXISTS "Allow admins to delete species" ON public.dbo_species;

-- SELECT: Allow all authenticated users to read
CREATE POLICY "Allow authenticated users to read species" 
ON public.dbo_species 
FOR SELECT 
TO authenticated 
USING (true);

-- INSERT: Allow only Admins and Superadmins to insert
CREATE POLICY "Allow admins to insert species" 
ON public.dbo_species 
FOR INSERT 
TO authenticated 
WITH CHECK (is_admin());

-- UPDATE: Allow only Admins and Superadmins to update
CREATE POLICY "Allow admins to update species" 
ON public.dbo_species 
FOR UPDATE 
TO authenticated 
USING (is_admin());

-- DELETE: Allow only Admins and Superadmins to delete
CREATE POLICY "Allow admins to delete species" 
ON public.dbo_species 
FOR DELETE 
TO authenticated 
USING (is_admin());
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
AND table_name = 'dbo_species'
ORDER BY ordinal_position;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'dbo_species';

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
WHERE tablename = 'dbo_species';
```

---

## Step 6: Insert Sample Data (Optional)

You can insert some sample data to test:

```sql
-- Insert sample species
INSERT INTO public.dbo_species (sp_name, sp_family, sp_sci) VALUES
    ('Tuna', 'Scombridae', 'Thunnus albacares'),
    ('Mackerel', 'Scombridae', 'Scomberomorus commerson'),
    ('Sardine', 'Clupeidae', 'Sardinella longiceps'),
    ('Shrimp', 'Penaeidae', 'Penaeus monodon'),
    ('Crab', 'Portunidae', 'Portunus pelagicus'),
    ('Squid', 'Loliginidae', 'Loligo duvauceli')
ON CONFLICT DO NOTHING;
```

---

## Troubleshooting

### Error: "function is_admin() does not exist"

This error means the helper function hasn't been created yet. **You must create the function BEFORE creating the RLS policies.**

Run the function creation script from **Step 2** above.

### Error: "column species_id does not exist"

Check the actual column name in your database. PostgreSQL converts unquoted identifiers to lowercase, so the column should be `species_id` (all lowercase). If you used quotes when creating the table, you may need to use quotes in queries as well.

---

## Verification Checklist

After running the scripts, verify:

- [ ] Table `dbo_species` exists
- [ ] Columns are correct: `species_id`, `sp_name`, `sp_family`, `sp_sci`, `created_at`, `updated_at`
- [ ] RLS is enabled on the table
- [ ] Policies are created (4 policies: SELECT, INSERT, UPDATE, DELETE)
- [ ] Indexes exist on `sp_name`, `sp_family`, and `sp_sci`
- [ ] Trigger for `updated_at` is working
- [ ] Can read data as any authenticated user
- [ ] Can insert/update/delete as admin/superadmin
- [ ] Cannot insert/update/delete as encoder/viewer

---

## Related Documentation

- `docs/SECURITY.md` - Security documentation including RLS policies
- `docs/RLS_POLICIES.md` - RLS policy implementation details
- `docs/FISHING_EFFORT_TABLE_GUIDE.md` - Similar reference table setup
- `docs/DATABASE_UPDATE_GUIDE.md` - Other database update scripts

---

**Last Updated:** January 2025  
**Status:** Ready for Implementation

