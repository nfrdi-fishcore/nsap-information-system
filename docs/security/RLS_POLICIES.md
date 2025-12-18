# Database Security Guide: Fixing Infinite Recursion

The error "infinite recursion detected" (Code 42P17) happens because the policy tries to read the `dbo_user` table to check if you are an admin, but reading the table triggers the policy again, creating an endless loop.

To fix this, we need to bypass RLS when checking for admin status. We do this using a "Security Definer" function.

## Instructions

Run this SQL block in Supabase to replace the failing policies with a robust, non-recursive solution.

```sql
-- 1. Drop the failing policies if they exist (to start fresh)
DROP POLICY IF EXISTS "Allow admins to insert profiles" ON dbo_user;
DROP POLICY IF EXISTS "Allow admins to update profiles" ON dbo_user;
DROP POLICY IF EXISTS "Allow all authenticated updates" ON dbo_user;
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON dbo_user;

-- 2. Create a helper function to check if current user is admin
-- SECURITY DEFINER means this function runs with higher privileges, bypassing RLS
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

-- 3. Create CLEAN policies using the helper function

-- Read: Allow everyone to read (needed to login/view)
CREATE POLICY "Allow authenticated users to read profiles" 
ON dbo_user FOR SELECT 
TO authenticated 
USING (true);

-- Insert: Allow only Admins to insert
CREATE POLICY "Allow admins to insert profiles" 
ON dbo_user FOR INSERT 
TO authenticated 
WITH CHECK ( is_admin() );

-- Update: Allow Admins to update ANY profile
CREATE POLICY "Allow admins to update profiles" 
ON dbo_user FOR UPDATE 
TO authenticated 
USING ( is_admin() );

-- Delete: Allow Admins to delete profiles
CREATE POLICY "Allow admins to delete profiles" 
ON dbo_user FOR DELETE 
TO authenticated 
USING ( is_admin() );
```

## Verification
After running this, try editing a user again. The recursion error should be gone.
