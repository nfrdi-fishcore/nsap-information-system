# Database Update Guide: User Avatar Storage

To support user profile images, we need to create a Storage Bucket in Supabase and configure permissions.

## FIX: Run this to Fix "Row-Level Security" Errors

If you are getting errors like "new row violates row-level security policy", run this **Reset & Fix** script in your Supabase SQL Editor.

It will clear old policies and set up fresh working ones.

```sql
-- 1. Ensure the bucket exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop any existing conflicting policies to start fresh
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;
DROP POLICY IF EXISTS "Public Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Updates" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Deletes" ON storage.objects;

-- 3. Create Policy: Public Read Access (Everyone can view)
CREATE POLICY "Public Avatars" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'avatars' );

-- 4. Create Policy: Authenticated Upload (Logged in users can upload)
CREATE POLICY "Avatar Uploads" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id = 'avatars' );

-- 5. Create Policy: Authenticated Update (Logged in users can update)
CREATE POLICY "Avatar Updates" 
ON storage.objects FOR UPDATE
TO authenticated 
USING ( bucket_id = 'avatars' );

-- 6. Create Policy: Authenticated Delete (Logged in users can delete)
CREATE POLICY "Avatar Deletes" 
ON storage.objects FOR DELETE
TO authenticated 
USING ( bucket_id = 'avatars' );

-- 7. Ensure dbo_user has the column
ALTER TABLE dbo_user ADD COLUMN IF NOT EXISTS user_img TEXT;

-- 8. Reload
NOTIFY pgrst, 'reload config';
```

## How to Run
1.  Copy the SQL code above.
2.  Go to Supabase Dashboard > **SQL Editor**.
3.  Paste the code and click **Run**.
4.  Try uploading the image again in the app.
