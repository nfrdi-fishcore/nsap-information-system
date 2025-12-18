
# Security Policy Update (RBAC & Region Isolation)

Run this SQL block to enforce stricter access controls. This replaces earlier generic policies.

```sql
-------------------------------------------------------------------------------
-- Helper Function to get Current User Permissions
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth.get_user_role_and_region()
RETURNS TABLE (role text, region_id int) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT role, region_id FROM public.dbo_user WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql;

-------------------------------------------------------------------------------
-- Policies for Landing Center (dbo_landing_center)
-------------------------------------------------------------------------------
ALTER TABLE dbo_landing_center ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON dbo_landing_center;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON dbo_landing_center;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON dbo_landing_center;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON dbo_landing_center;

-- SELECT: Admins see all, Encoders/Viewers see own region
CREATE POLICY "RBAC Select LC" ON dbo_landing_center FOR SELECT TO authenticated
USING (
  (SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin') 
  OR 
  region_id = (SELECT region_id FROM auth.get_user_role_and_region())
);

-- INSERT: Admins and Encoders (for their region)
CREATE POLICY "RBAC Insert LC" ON dbo_landing_center FOR INSERT TO authenticated
WITH CHECK (
  ((SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin'))
  OR 
  ((SELECT role FROM auth.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM auth.get_user_role_and_region()))
);

-- UPDATE: Admins and Encoders (their region)
CREATE POLICY "RBAC Update LC" ON dbo_landing_center FOR UPDATE TO authenticated
USING (
  ((SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin'))
  OR 
  ((SELECT role FROM auth.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM auth.get_user_role_and_region()))
);

-- DELETE: Admins and Encoders (their region)
CREATE POLICY "RBAC Delete LC" ON dbo_landing_center FOR DELETE TO authenticated
USING (
  ((SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin'))
  OR 
  ((SELECT role FROM auth.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM auth.get_user_role_and_region()))
);

-------------------------------------------------------------------------------
-- Policies for Fishing Ground (dbo_fishing_ground)
-------------------------------------------------------------------------------
ALTER TABLE dbo_fishing_ground ENABLE ROW LEVEL SECURITY;
-- (Repeat logic or use generic loop if scripting, but explicit is safer here)
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON dbo_fishing_ground;
-- ... [Assuming dropping old generic policies] ...

-- SELECT
CREATE POLICY "RBAC Select FG" ON dbo_fishing_ground FOR SELECT TO authenticated
USING (
  (SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin') 
  OR 
  region_id = (SELECT region_id FROM auth.get_user_role_and_region())
);

-- MODIFICATIONS (Insert/Update/Delete combined for brevity in guide, separate in practice if needed)
CREATE POLICY "RBAC Modify FG" ON dbo_fishing_ground FOR ALL TO authenticated
USING (
  ((SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin'))
  OR 
  ((SELECT role FROM auth.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM auth.get_user_role_and_region()))
);
-- Note: 'FOR ALL' covers INSERT/UPDATE/DELETE/SELECT, but we defined SELECT separately above. 
-- To be precise and separate 'WITH CHECK' for INSERT, we stick to specific policies.

CREATE POLICY "RBAC Insert FG" ON dbo_fishing_ground FOR INSERT TO authenticated
WITH CHECK (
  ((SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin')) OR 
  ((SELECT role FROM auth.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM auth.get_user_role_and_region()))
);

CREATE POLICY "RBAC Update FG" ON dbo_fishing_ground FOR UPDATE TO authenticated
USING (
  ((SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin')) OR 
  ((SELECT role FROM auth.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM auth.get_user_role_and_region()))
);

CREATE POLICY "RBAC Delete FG" ON dbo_fishing_ground FOR DELETE TO authenticated
USING (
  ((SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin')) OR 
  ((SELECT role FROM auth.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM auth.get_user_role_and_region()))
);

-------------------------------------------------------------------------------
-- Policies for Sampling Day (dbo_LC_FG_sample_day)
-------------------------------------------------------------------------------
ALTER TABLE dbo_LC_FG_sample_day ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RBAC Select SD" ON dbo_LC_FG_sample_day FOR SELECT TO authenticated
USING (
  (SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin') 
  OR 
  region_id = (SELECT region_id FROM auth.get_user_role_and_region())
);

CREATE POLICY "RBAC Insert SD" ON dbo_LC_FG_sample_day FOR INSERT TO authenticated
WITH CHECK (
  ((SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin')) OR 
  ((SELECT role FROM auth.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM auth.get_user_role_and_region()))
);

CREATE POLICY "RBAC Update SD" ON dbo_LC_FG_sample_day FOR UPDATE TO authenticated
USING (
  ((SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin')) OR 
  ((SELECT role FROM auth.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM auth.get_user_role_and_region()))
);

CREATE POLICY "RBAC Delete SD" ON dbo_LC_FG_sample_day FOR DELETE TO authenticated
USING (
  ((SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin')) OR 
  ((SELECT role FROM auth.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM auth.get_user_role_and_region()))
);
```
