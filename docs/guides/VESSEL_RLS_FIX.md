# Quick Fix: Vessel RLS Policies Error

## Error Message
```
ERROR: 42883: function auth.get_user_role_and_region() does not exist
HINT: No function matches the given name and argument types.
```

## Solution

The `public.get_user_role_and_region()` function must be created **BEFORE** creating the RLS policies. 

**Important:** Supabase restricts access to the `auth` schema, so we create this function in the `public` schema instead.

Run this script first:

```sql
-- Step 1: Create the helper function in public schema
-- Note: auth schema is restricted in Supabase, so we use public schema
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

**All RLS policies use `public.get_user_role_and_region()` (not `auth.get_user_role_and_region()`).**

---

## Step 2: Verify Function Exists

After creating the function, verify it exists:

```sql
-- Check if function exists
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'get_user_role_and_region';
```

You should see a row with the function name and schema.

---

## Step 3: Create RLS Policies

Now you can create the RLS policies for the `dbo_vessel` table. Use the scripts from `docs/VESSEL_TABLE_GUIDE.md` starting from Step 4 (Create RLS Policies).

---

## Alternative: Use Public Schema

If you prefer to keep everything in the `public` schema, you can:

1. Create the function in `public` schema (as shown above)
2. Update all RLS policies to use `public.get_user_role_and_region()` instead of `auth.get_user_role_and_region()`

Example policy update:
```sql
-- Change from:
(SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin')

-- To:
(SELECT role FROM public.get_user_role_and_region()) IN ('superadmin', 'admin')
```

---

## Verification

After creating the function and policies, test with:

```sql
-- Test the function (should return your role and region_id)
SELECT * FROM public.get_user_role_and_region();

-- Check policies exist
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename = 'dbo_vessel';
```

You should see 4 policies: SELECT, INSERT, UPDATE, DELETE.

---

**Last Updated:** January 2025  
**Status:** Quick Fix Guide

