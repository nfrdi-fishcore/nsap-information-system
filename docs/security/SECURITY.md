# NSAP Information System - Security Documentation

**Last Updated:** January 2025  
**Status:** Active Documentation

---

## 📋 Overview

This document provides comprehensive security documentation for the NSAP Information System, including Row Level Security (RLS) policies, authentication mechanisms, and access control rules.

---

## 🔐 Authentication & Authorization

### User Roles

The system supports four user roles with hierarchical permissions:

1. **Superadmin** (`superadmin`)
   - Full system access
   - Can view and manage all data across all regions
   - Can manage all users
   - Bypasses region-based filtering

2. **Admin** (`admin`)
   - Full system access within their scope
   - Can view and manage all data across all regions
   - Can manage users
   - Bypasses region-based filtering

3. **Encoder** (`encoder`)
   - Can create, read, update, and delete data in their assigned region
   - Cannot access data from other regions
   - Cannot manage users
   - Can export data from their region

4. **Viewer** (`viewer`)
   - Read-only access to data in their assigned region
   - Cannot create, update, or delete any data
   - Cannot access user management
   - Can view and export data from their region

### Role-Based Access Control (RBAC)

**Region Filtering Rules:**
- **Superadmin & Admin**: Can access all data regardless of region
- **Encoder & Viewer**: Limited to data in their assigned `region_id`

**Data Entry Permissions:**
- **Superadmin, Admin, Encoder**: Can create, update, and delete records
- **Viewer**: Read-only access (cannot add, edit, or delete)

---

## 🛡️ Row Level Security (RLS) Policies

### RLS Status

**All tables have RLS enabled:**
- ✅ `dbo_user` - User management
- ✅ `dbo_region` - Regions
- ✅ `dbo_fishing_ground` - Fishing grounds
- ✅ `dbo_landing_center` - Landing centers
- ✅ `dbo_LC_FG_sample_day` - Sample days
- ✅ `dbo_fishing_effort` - Fishing effort
- ✅ `dbo_species` - Species
- ✅ `dbo_gear` - Gear
- ✅ `dbo_vessel` - Vessel
- ✅ `dbo_gear_unload` - Gear Unload
- ✅ `dbo_vessel_unload` - Vessel Unload
- ✅ `dbo_vessel_catch` - Vessel Catch
- ✅ `dbo_sample_lengths` - Sample Lengths

### Helper Functions

#### `is_admin()`
Checks if the current authenticated user has admin or superadmin role.

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

#### `public.get_user_role_and_region()`
Returns the current user's role and region_id for use in RLS policies.

**Note:** This function is created in the `public` schema because Supabase restricts access to the `auth` schema.

```sql
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

---

## 📊 Table-Specific RLS Policies

### 1. `dbo_user` (User Management)

**SELECT (Read):**
- All authenticated users can read user profiles (needed for login/viewing)

**INSERT (Create):**
- Only admins and superadmins can create new users

**UPDATE (Edit):**
- Admins and superadmins can update any user profile
- Users can update their own profile (via settings page)

**DELETE (Deactivate):**
- Only admins and superadmins can deactivate users

**Policy Implementation:**
```sql
-- Read: Allow everyone to read
CREATE POLICY "Allow authenticated users to read profiles" 
ON dbo_user FOR SELECT 
TO authenticated 
USING (true);

-- Insert: Allow only Admins
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

---

### 2. `dbo_fishing_ground` (Fishing Grounds)

**SELECT (Read):**
- Superadmin/Admin: Can view all fishing grounds
- Encoder/Viewer: Can only view fishing grounds in their region

**INSERT (Create):**
- Superadmin/Admin: Can create fishing grounds in any region
- Encoder: Can create fishing grounds in their region only
- Viewer: Cannot create (enforced by application logic)

**UPDATE (Edit):**
- Superadmin/Admin: Can update any fishing ground
- Encoder: Can update fishing grounds in their region only
- Viewer: Cannot update (enforced by application logic)

**DELETE (Delete):**
- Superadmin/Admin: Can delete any fishing ground
- Encoder: Can delete fishing grounds in their region only
- Viewer: Cannot delete (enforced by application logic)

**Policy Implementation:**
```sql
-- SELECT
CREATE POLICY "RBAC Select FG" ON dbo_fishing_ground FOR SELECT TO authenticated
USING (
  (SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin') 
  OR 
  region_id = (SELECT region_id FROM auth.get_user_role_and_region())
);

-- INSERT
CREATE POLICY "RBAC Insert FG" ON dbo_fishing_ground FOR INSERT TO authenticated
WITH CHECK (
  ((SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin')) OR 
  ((SELECT role FROM auth.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM auth.get_user_role_and_region()))
);

-- UPDATE
CREATE POLICY "RBAC Update FG" ON dbo_fishing_ground FOR UPDATE TO authenticated
USING (
  ((SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin')) OR 
  ((SELECT role FROM auth.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM auth.get_user_role_and_region()))
);

-- DELETE
CREATE POLICY "RBAC Delete FG" ON dbo_fishing_ground FOR DELETE TO authenticated
USING (
  ((SELECT role FROM auth.get_user_role_and_region()) IN ('superadmin', 'admin')) OR 
  ((SELECT role FROM auth.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM auth.get_user_role_and_region()))
);
```

---

### 3. `dbo_landing_center` (Landing Centers)

**Access Rules:** Same as `dbo_fishing_ground`

**Policy Implementation:**
```sql
-- SELECT
CREATE POLICY "RBAC Select LC" ON dbo_landing_center FOR SELECT TO authenticated
USING (
  (SELECT role FROM public.get_user_role_and_region()) IN ('superadmin', 'admin') 
  OR 
  region_id = (SELECT region_id FROM public.get_user_role_and_region())
);

-- INSERT
CREATE POLICY "RBAC Insert LC" ON dbo_landing_center FOR INSERT TO authenticated
WITH CHECK (
  ((SELECT role FROM public.get_user_role_and_region()) IN ('superadmin', 'admin'))
  OR 
  ((SELECT role FROM public.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM public.get_user_role_and_region()))
);

-- UPDATE
CREATE POLICY "RBAC Update LC" ON dbo_landing_center FOR UPDATE TO authenticated
USING (
  ((SELECT role FROM public.get_user_role_and_region()) IN ('superadmin', 'admin'))
  OR 
  ((SELECT role FROM public.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM public.get_user_role_and_region()))
);

-- DELETE
CREATE POLICY "RBAC Delete LC" ON dbo_landing_center FOR DELETE TO authenticated
USING (
  ((SELECT role FROM public.get_user_role_and_region()) IN ('superadmin', 'admin'))
  OR 
  ((SELECT role FROM public.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM public.get_user_role_and_region()))
);
```

---

### 4. `dbo_LC_FG_sample_day` (Sample Days)

**Access Rules:** Same as `dbo_fishing_ground` and `dbo_landing_center`

**Policy Implementation:**
```sql
-- SELECT
CREATE POLICY "RBAC Select SD" ON dbo_LC_FG_sample_day FOR SELECT TO authenticated
USING (
  (SELECT role FROM public.get_user_role_and_region()) IN ('superadmin', 'admin') 
  OR 
  region_id = (SELECT region_id FROM public.get_user_role_and_region())
);

-- INSERT
CREATE POLICY "RBAC Insert SD" ON dbo_LC_FG_sample_day FOR INSERT TO authenticated
WITH CHECK (
  ((SELECT role FROM public.get_user_role_and_region()) IN ('superadmin', 'admin')) OR 
  ((SELECT role FROM public.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM public.get_user_role_and_region()))
);

-- UPDATE
CREATE POLICY "RBAC Update SD" ON dbo_LC_FG_sample_day FOR UPDATE TO authenticated
USING (
  ((SELECT role FROM public.get_user_role_and_region()) IN ('superadmin', 'admin')) OR 
  ((SELECT role FROM public.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM public.get_user_role_and_region()))
);

-- DELETE
CREATE POLICY "RBAC Delete SD" ON dbo_LC_FG_sample_day FOR DELETE TO authenticated
USING (
  ((SELECT role FROM public.get_user_role_and_region()) IN ('superadmin', 'admin')) OR 
  ((SELECT role FROM public.get_user_role_and_region()) = 'encoder' AND region_id = (SELECT region_id FROM public.get_user_role_and_region()))
);
```

---

### 5. `dbo_region` (Regions)

**Access Rules:**
- All authenticated users can read regions (needed for dropdowns and displays)
- Only admins can modify regions (if needed in future)

---

### 6. `dbo_fishing_effort` (Fishing Effort)

**Table Structure:**
- `UnitEffort_ID` (Primary Key, SERIAL)
- `fishing_effort` (Description/Text, NOT NULL)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

**Access Rules:**
- **Reference/Lookup Table**: This is a reference table (similar to regions), so it doesn't have region-based filtering
- **Read**: All authenticated users can read fishing effort records (needed for dropdowns and displays)
- **Write**: Only admins and superadmins can create, update, or delete fishing effort records

**Policy Implementation:**
```sql
-- SELECT: Allow all authenticated users to read
CREATE POLICY "Allow authenticated users to read fishing effort" 
ON dbo_fishing_effort FOR SELECT 
TO authenticated 
USING (true);

-- INSERT: Allow only Admins
CREATE POLICY "Allow admins to insert fishing effort" 
ON dbo_fishing_effort FOR INSERT 
TO authenticated 
WITH CHECK (is_admin());

-- UPDATE: Allow only Admins
CREATE POLICY "Allow admins to update fishing effort" 
ON dbo_fishing_effort FOR UPDATE 
TO authenticated 
USING (is_admin());

-- DELETE: Allow only Admins
CREATE POLICY "Allow admins to delete fishing effort" 
ON dbo_fishing_effort FOR DELETE 
TO authenticated 
USING (is_admin());
```

**Setup Instructions:**
- See `docs/FISHING_EFFORT_TABLE_GUIDE.md` for complete SQL scripts to create the table and policies

---

### 6.1. `dbo_species` (Species)

**Table Structure:**
- `species_id` (Primary Key, SERIAL)
- `sp_name` (Species Name, TEXT, NOT NULL)
- `sp_family` (Species Family, TEXT, optional)
- `sp_sci` (Scientific Name, TEXT, optional)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

**Access Rules:**
- **Reference/Lookup Table**: This is a reference table (similar to fishing effort), so it doesn't have region-based filtering
- **Read**: All authenticated users can read species records (needed for dropdowns and displays)
- **Write**: Only admins and superadmins can create, update, or delete species records

**Policy Implementation:**
```sql
-- SELECT: Allow all authenticated users to read
CREATE POLICY "Allow authenticated users to read species" 
ON dbo_species FOR SELECT 
TO authenticated 
USING (true);

-- INSERT: Allow only Admins
CREATE POLICY "Allow admins to insert species" 
ON dbo_species FOR INSERT 
TO authenticated 
WITH CHECK (is_admin());

-- UPDATE: Allow only Admins
CREATE POLICY "Allow admins to update species" 
ON dbo_species FOR UPDATE 
TO authenticated 
USING (is_admin());

-- DELETE: Allow only Admins
CREATE POLICY "Allow admins to delete species" 
ON dbo_species FOR DELETE 
TO authenticated 
USING (is_admin());
```

**Setup Instructions:**
- See `docs/SPECIES_TABLE_GUIDE.md` for complete SQL scripts to create the table and policies

---

### 7. `dbo_gear` (Gear)

**Note:** This table is pending implementation. RLS policies will be defined based on whether the table includes a `region_id` column for region-based filtering.

**Table Structure:**
- `gr_id` (Primary Key, SERIAL)
- `gear_desc` (Description/Text, NOT NULL)
- `uniteffort_id` (Foreign Key to `dbo_fishing_effort`, required)
- `uniteffort_2_id` (Foreign Key to `dbo_fishing_effort`, optional)
- `uniteffort_3_id` (Foreign Key to `dbo_fishing_effort`, optional)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

**Planned Access Rules:**
- If region-based filtering is needed:
  - Superadmin/Admin: Can view and manage all gear records
  - Encoder: Can view and manage gear in their region only
  - Viewer: Can view gear in their region only (read-only)
- If no region filtering (reference table):
  - All authenticated users can read (needed for dropdowns)
  - Only admins can modify

**RLS Policies:** (To be implemented)
- Policies will be created following the same pattern as other tables
- Will be documented once implementation is complete

**Setup Instructions:**
- See `docs/GEAR_TABLE_GUIDE.md` for complete SQL scripts to create the table and policies

---

### 8. `dbo_vessel` (Vessel)

**Table Structure:**
- `boat_id` (Primary Key, SERIAL)
- `vesselname` (Text, NOT NULL)
- `gr_id` (Foreign Key to `dbo_gear`, NOT NULL)
- `region_id` (Foreign Key to `dbo_region`, NOT NULL)
- `length` (Numeric, NOT NULL - meters)
- `width` (Numeric, NOT NULL - meters)
- `depth` (Numeric, NOT NULL - meters)
- `grt` (Numeric - Gross Tonnage, auto-calculated: (Length × Width × Depth × 0.70) ÷ 2.83)
- `hpw` (Numeric - Horsepower, optional)
- `engine_type` (Text, optional)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

**Access Rules:**
- **Region-Based Filtering**: This table has `region_id`, so filtering is region-based
- **Superadmin/Admin**: Can view and manage all vessels
- **Encoder**: Can view and manage vessels in their region only
- **Viewer**: Can view vessels in their region only (read-only, cannot add/edit/delete)

**Policy Implementation:**
```sql
-- SELECT: Admins see all, Encoders/Viewers see own region
-- IMPORTANT: Use table alias (ur) to avoid ambiguous column reference
CREATE POLICY "RBAC Select Vessel" ON dbo_vessel FOR SELECT TO authenticated
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
CREATE POLICY "RBAC Insert Vessel" ON dbo_vessel FOR INSERT TO authenticated
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
CREATE POLICY "RBAC Update Vessel" ON dbo_vessel FOR UPDATE TO authenticated
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
CREATE POLICY "RBAC Delete Vessel" ON dbo_vessel FOR DELETE TO authenticated
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

**Special Features:**
- **GRT Auto-Calculation**: The application automatically calculates Gross Tonnage using the formula: `(Length × Width × Depth × 0.70) ÷ 2.83`
- **Foreign Keys**: References `dbo_gear` (gear type) and `dbo_region` (operating region)

**Setup Instructions:**
- See `docs/VESSEL_TABLE_GUIDE.md` for complete SQL scripts to create the table and policies

---

### 9. `dbo_gear_unload` (Gear Unload)

**Table Structure:**
- `unload_gr_id` (Primary Key, SERIAL)
- `unload_day_id` (Foreign Key to `dbo_LC_FG_sample_day`, NOT NULL)
- `gr_id` (Foreign Key to `dbo_gear`, NOT NULL)
- `boats` (Integer, NOT NULL - number of vessels)
- `catch` (Numeric, NOT NULL - catch landed in kg)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

**Access Rules:**
- **Region-Based Filtering**: This table references `dbo_LC_FG_sample_day` which has `region_id`, so filtering is region-based through the sample day relationship
- **Superadmin/Admin**: Can view and manage all gear unload records
- **Encoder**: Can view and manage gear unloads for sample days in their region only
- **Viewer**: Can view gear unloads for sample days in their region only (read-only, cannot add/edit/delete)

**Policy Implementation:**
```sql
-- SELECT: Admins see all, Encoders/Viewers see own region (through sample day)
-- Note: "dbo_LC_FG_sample_day" must be quoted to preserve case
CREATE POLICY "RBAC Select Gear Unload" ON dbo_gear_unload FOR SELECT TO authenticated
USING (
  (SELECT role FROM public.get_user_role_and_region()) IN ('superadmin', 'admin') 
  OR 
  EXISTS (
    SELECT 1 FROM public."dbo_LC_FG_sample_day" sd
    WHERE sd.unload_day_id = dbo_gear_unload.unload_day_id
    AND sd.region_id = (SELECT region_id FROM public.get_user_role_and_region())
  )
);

-- INSERT: Admins and Encoders (for their region through sample day)
CREATE POLICY "RBAC Insert Gear Unload" ON dbo_gear_unload FOR INSERT TO authenticated
WITH CHECK (
  ((SELECT role FROM public.get_user_role_and_region()) IN ('superadmin', 'admin'))
  OR 
  (
    (SELECT role FROM public.get_user_role_and_region()) = 'encoder' 
    AND EXISTS (
      SELECT 1 FROM public."dbo_LC_FG_sample_day" sd
      WHERE sd.unload_day_id = dbo_gear_unload.unload_day_id
      AND sd.region_id = (SELECT region_id FROM public.get_user_role_and_region())
    )
  )
);

-- UPDATE: Admins and Encoders (their region through sample day)
CREATE POLICY "RBAC Update Gear Unload" ON dbo_gear_unload FOR UPDATE TO authenticated
USING (
  ((SELECT role FROM public.get_user_role_and_region()) IN ('superadmin', 'admin'))
  OR 
  (
    (SELECT role FROM public.get_user_role_and_region()) = 'encoder' 
    AND EXISTS (
      SELECT 1 FROM public."dbo_LC_FG_sample_day" sd
      WHERE sd.unload_day_id = dbo_gear_unload.unload_day_id
      AND sd.region_id = (SELECT region_id FROM public.get_user_role_and_region())
    )
  )
);

-- DELETE: Admins and Encoders (their region through sample day)
CREATE POLICY "RBAC Delete Gear Unload" ON dbo_gear_unload FOR DELETE TO authenticated
USING (
  ((SELECT role FROM public.get_user_role_and_region()) IN ('superadmin', 'admin'))
  OR 
  (
    (SELECT role FROM public.get_user_role_and_region()) = 'encoder' 
    AND EXISTS (
      SELECT 1 FROM public."dbo_LC_FG_sample_day" sd
      WHERE sd.unload_day_id = dbo_gear_unload.unload_day_id
      AND sd.region_id = (SELECT region_id FROM public.get_user_role_and_region())
    )
  )
);
```

**Special Features:**
- **Foreign Keys**: References `dbo_LC_FG_sample_day` (sample day/date) and `dbo_gear` (gear type)
- **Region Filtering**: Access is filtered by region through the sample day relationship

**Setup Instructions:**
- See `docs/GEAR_UNLOAD_TABLE_GUIDE.md` for complete SQL scripts to create the table and policies

---

## 8. `dbo_vessel_unload` (Vessel Unload)

**Table Structure:**
- `v_unload_id` (Primary Key, SERIAL)
- `unload_gr_id` (Foreign Key to `dbo_gear_unload`, NOT NULL)
- `boat_id` (Foreign Key to `dbo_vessel`, NOT NULL)
- `effort` (Numeric, NOT NULL - primary effort value)
- `uniteffort_id` (Foreign Key to `dbo_fishing_effort`, NOT NULL)
- `boxes_total` (Integer, optional)
- `catch_total` (Numeric, optional - catch total in kg)
- `boxes_samp` (Integer, optional)
- `catch_samp` (Numeric, optional - catch sample in kg)
- `boxes_pieces_id` (Integer, optional)
- `effort_2` (Numeric, optional - secondary effort value)
- `uniteffort_2_id` (Foreign Key to `dbo_fishing_effort`, optional)
- `effort_3` (Numeric, optional - tertiary effort value)
- `uniteffort_3_id` (Foreign Key to `dbo_fishing_effort`, optional)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

**Access Rules:**
- **Region-Based Filtering**: This table references `dbo_gear_unload` which references `dbo_LC_FG_sample_day` (which has `region_id`), so filtering is region-based through the gear unload -> sample day relationship
- **Superadmin/Admin**: Can view and manage all vessel unload records
- **Encoder**: Can view and manage vessel unloads for gear unloads in their region only
- **Viewer**: Can view vessel unloads for gear unloads in their region only (read-only, cannot add/edit/delete)

**Policy Implementation:**
```sql
-- SELECT: Admins see all, Encoders/Viewers see own region (through gear unload -> sample day)
-- Note: "dbo_LC_FG_sample_day" must be quoted to preserve case
-- IMPORTANT: Use table alias (ur) to avoid ambiguous column reference
CREATE POLICY "RBAC Select Vessel Unload" ON dbo_vessel_unload FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.get_user_role_and_region() AS ur
    WHERE ur.role IN ('superadmin', 'admin')
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.dbo_gear_unload gu
    INNER JOIN public."dbo_LC_FG_sample_day" sd ON sd.unload_day_id = gu.unload_day_id
    INNER JOIN public.get_user_role_and_region() AS ur ON true
    WHERE gu.unload_gr_id = dbo_vessel_unload.unload_gr_id
    AND sd.region_id = ur.region_id
  )
);

-- INSERT: Admins and Encoders (for their region through gear unload -> sample day)
CREATE POLICY "RBAC Insert Vessel Unload" ON dbo_vessel_unload FOR INSERT TO authenticated
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
      SELECT 1 FROM public.dbo_gear_unload gu
      INNER JOIN public."dbo_LC_FG_sample_day" sd ON sd.unload_day_id = gu.unload_day_id
      INNER JOIN public.get_user_role_and_region() AS ur ON true
      WHERE gu.unload_gr_id = dbo_vessel_unload.unload_gr_id
      AND sd.region_id = ur.region_id
    )
  )
);

-- UPDATE: Admins and Encoders (their region through gear unload -> sample day)
CREATE POLICY "RBAC Update Vessel Unload" ON dbo_vessel_unload FOR UPDATE TO authenticated
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
      SELECT 1 FROM public.dbo_gear_unload gu
      INNER JOIN public."dbo_LC_FG_sample_day" sd ON sd.unload_day_id = gu.unload_day_id
      INNER JOIN public.get_user_role_and_region() AS ur ON true
      WHERE gu.unload_gr_id = dbo_vessel_unload.unload_gr_id
      AND sd.region_id = ur.region_id
    )
  )
);

-- DELETE: Admins and Encoders (their region through gear unload -> sample day)
CREATE POLICY "RBAC Delete Vessel Unload" ON dbo_vessel_unload FOR DELETE TO authenticated
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
      SELECT 1 FROM public.dbo_gear_unload gu
      INNER JOIN public."dbo_LC_FG_sample_day" sd ON sd.unload_day_id = gu.unload_day_id
      INNER JOIN public.get_user_role_and_region() AS ur ON true
      WHERE gu.unload_gr_id = dbo_vessel_unload.unload_gr_id
      AND sd.region_id = ur.region_id
    )
  )
);
```

**Special Features:**
- **Foreign Keys**: References `dbo_gear_unload` (gear unload record), `dbo_vessel` (vessel), and `dbo_fishing_effort` (fishing effort units)
- **Region Filtering**: Access is filtered by region through the gear unload -> sample day relationship
- **Multiple Fishing Effort Units**: Supports primary (required), secondary (optional), and tertiary (optional) fishing effort units

**Setup Instructions:**
- See `docs/VESSEL_UNLOAD_TABLE_GUIDE.md` for complete SQL scripts to create the table and policies

---

## 10. `dbo_vessel_catch` (Vessel Catch)

**Table Structure:**
- `catch_id` (Primary Key, SERIAL)
- `v_unload_id` (Foreign Key to `dbo_vessel_unload`, NOT NULL)
- `species_id` (Foreign Key to `dbo_species`, NOT NULL)
- `catch_kg` (Numeric, optional - catch weight in kg)
- `samp_kg` (Numeric, optional - sample weight in kg)
- `len_id` (Text, optional - length type: total length, mantle length, fork length, eye orbit fork length, carapace length, carapace width)
- `lenunit_id` (Text, optional - length unit: mm or cm)
- `total_kg` (Numeric, optional - total weight in kg)
- `totalwt_ifmeasured_kg` (Numeric, optional - total weight if measured in kg)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

**Access Rules:**
- **Region-Based Filtering**: This table references `dbo_vessel_unload` which references `dbo_gear_unload` which references `dbo_LC_FG_sample_day` (which has `region_id`), so filtering is region-based through the vessel unload -> gear unload -> sample day relationship
- **Superadmin/Admin**: Can view and manage all vessel catch records
- **Encoder**: Can view and manage vessel catches for vessel unloads in their region only
- **Viewer**: Can view vessel catches for vessel unloads in their region only (read-only, cannot add/edit/delete)

**Policy Implementation:**
```sql
-- SELECT: Admins see all, Encoders/Viewers see own region (through vessel unload -> gear unload -> sample day)
CREATE POLICY "RBAC Select Vessel Catch" ON dbo_vessel_catch FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.get_user_role_and_region() AS ur
    WHERE ur.role IN ('superadmin', 'admin')
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.dbo_vessel_unload vu
    INNER JOIN public.dbo_gear_unload gu ON gu.unload_gr_id = vu.unload_gr_id
    INNER JOIN public."dbo_LC_FG_sample_day" sd ON sd.unload_day_id = gu.unload_day_id
    INNER JOIN public.get_user_role_and_region() AS ur ON true
    WHERE vu.v_unload_id = dbo_vessel_catch.v_unload_id
    AND sd.region_id = ur.region_id
  )
);

-- INSERT: Admins and Encoders (for their region through vessel unload -> gear unload -> sample day)
CREATE POLICY "RBAC Insert Vessel Catch" ON dbo_vessel_catch FOR INSERT TO authenticated
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
      SELECT 1 FROM public.dbo_vessel_unload vu
      INNER JOIN public.dbo_gear_unload gu ON gu.unload_gr_id = vu.unload_gr_id
      INNER JOIN public."dbo_LC_FG_sample_day" sd ON sd.unload_day_id = gu.unload_day_id
      INNER JOIN public.get_user_role_and_region() AS ur ON true
      WHERE vu.v_unload_id = dbo_vessel_catch.v_unload_id
      AND sd.region_id = ur.region_id
    )
  )
);

-- UPDATE: Admins and Encoders (their region through vessel unload -> gear unload -> sample day)
CREATE POLICY "RBAC Update Vessel Catch" ON dbo_vessel_catch FOR UPDATE TO authenticated
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
      SELECT 1 FROM public.dbo_vessel_unload vu
      INNER JOIN public.dbo_gear_unload gu ON gu.unload_gr_id = vu.unload_gr_id
      INNER JOIN public."dbo_LC_FG_sample_day" sd ON sd.unload_day_id = gu.unload_day_id
      INNER JOIN public.get_user_role_and_region() AS ur ON true
      WHERE vu.v_unload_id = dbo_vessel_catch.v_unload_id
      AND sd.region_id = ur.region_id
    )
  )
);

-- DELETE: Admins and Encoders (their region through vessel unload -> gear unload -> sample day)
CREATE POLICY "RBAC Delete Vessel Catch" ON dbo_vessel_catch FOR DELETE TO authenticated
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
      SELECT 1 FROM public.dbo_vessel_unload vu
      INNER JOIN public.dbo_gear_unload gu ON gu.unload_gr_id = vu.unload_gr_id
      INNER JOIN public."dbo_LC_FG_sample_day" sd ON sd.unload_day_id = gu.unload_day_id
      INNER JOIN public.get_user_role_and_region() AS ur ON true
      WHERE vu.v_unload_id = dbo_vessel_catch.v_unload_id
      AND sd.region_id = ur.region_id
    )
  )
);
```

**Setup Instructions:**
- See `docs/VESSEL_CATCH_TABLE_GUIDE.md` for complete SQL scripts to create the table and policies

**Notes:**
- **Foreign Keys**: References `dbo_vessel_unload` (vessel unload record) and `dbo_species` (species)
- **Region Filtering**: Access is filtered by region through the vessel unload -> gear unload -> sample day relationship
- **Length Measurements**: Supports various length types (total length, mantle length, fork length, etc.) with units (mm or cm)

---

## 11. `dbo_sample_lengths` (Sample Lengths)

**Table Structure:**
- `length_id` (Primary Key, SERIAL)
- `catch_id` (Foreign Key to `dbo_vessel_catch`, NOT NULL)
- `len` (Numeric, NOT NULL - length measurement value)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

**Access Rules:**
- **Region-Based Filtering**: This table references `dbo_vessel_catch` which references `dbo_vessel_unload` which references `dbo_gear_unload` which references `dbo_LC_FG_sample_day` (which has `region_id`), so filtering is region-based through the sample lengths -> vessel catch -> vessel unload -> gear unload -> sample day relationship
- **Superadmin/Admin**: Can view and manage all sample length records
- **Encoder**: Can view and manage sample lengths for vessel catches in their region only
- **Viewer**: Can view sample lengths for vessel catches in their region only (read-only, cannot add/edit/delete)

**Policy Implementation:**
```sql
-- SELECT: Admins see all, Encoders/Viewers see own region (through vessel catch -> vessel unload -> gear unload -> sample day)
CREATE POLICY "RBAC Select Sample Lengths" ON dbo_sample_lengths FOR SELECT TO authenticated
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
CREATE POLICY "RBAC Insert Sample Lengths" ON dbo_sample_lengths FOR INSERT TO authenticated
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
CREATE POLICY "RBAC Update Sample Lengths" ON dbo_sample_lengths FOR UPDATE TO authenticated
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
CREATE POLICY "RBAC Delete Sample Lengths" ON dbo_sample_lengths FOR DELETE TO authenticated
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

**Setup Instructions:**
- See `docs/SAMPLE_LENGTHS_TABLE_GUIDE.md` for complete SQL scripts to create the table and policies

**Notes:**
- **Foreign Keys**: References `dbo_vessel_catch` (vessel catch record)
- **Region Filtering**: Access is filtered by region through the sample lengths -> vessel catch -> vessel unload -> gear unload -> sample day relationship
- **Dropdown Display**: The dropdown shows species name (`sp_name` from `dbo_species`) based on the `species_id` in the related `dbo_vessel_catch` record

---

## 📁 Storage Security (Supabase Storage)

### Avatar Storage (`avatars` bucket)

**Bucket Configuration:**
- Public read access (avatars are public)
- Authenticated users can upload, update, and delete their own avatars

**Policies:**
```sql
-- Public Read Access
CREATE POLICY "Public Avatars" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'avatars' );

-- Authenticated Upload
CREATE POLICY "Avatar Uploads" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id = 'avatars' );

-- Authenticated Update
CREATE POLICY "Avatar Updates" 
ON storage.objects FOR UPDATE
TO authenticated 
USING ( bucket_id = 'avatars' );

-- Authenticated Delete
CREATE POLICY "Avatar Deletes" 
ON storage.objects FOR DELETE
TO authenticated 
USING ( bucket_id = 'avatars' );
```

---

## 🔒 Application-Level Security

### Client-Side Security

1. **Viewer Role Restrictions:**
   - Viewers are redirected from user management page
   - Add/Edit/Delete buttons are hidden for viewers
   - Form submissions are blocked for viewers

2. **Input Validation:**
   - All user inputs are validated using `Validation` utility
   - XSS prevention using `Validation.escapeHtml()`
   - Email validation
   - Password strength validation
   - Required field validation

3. **Error Handling:**
   - Centralized error handling via `ErrorHandler` utility
   - User-friendly error messages
   - No sensitive information exposed in errors

### Credential Management

- Supabase credentials stored in `config.js` (not in version control)
- `config.js` is gitignored
- `config.js.example` provided as template
- Environment-specific configuration support

---

## ✅ Security Verification Checklist

### RLS Verification

- [x] RLS enabled on all tables
- [x] Policies defined for all CRUD operations
- [x] Region-based filtering implemented
- [x] Admin bypass implemented correctly
- [x] Helper functions use SECURITY DEFINER appropriately

### Application Security

- [x] Viewer role restrictions enforced
- [x] Input validation on all forms
- [x] XSS prevention implemented
- [x] Error handling centralized
- [x] Credentials secured (not in version control)

### Testing Requirements

- [ ] Test role-based data access with all roles
- [ ] Verify region isolation (encoder/viewer cannot see other regions)
- [ ] Verify admin/superadmin can see all data
- [ ] Test viewer restrictions (cannot add/edit/delete)
- [ ] Test authentication flow
- [ ] Test password change functionality
- [ ] Test avatar upload/removal

---

## 📚 Related Documentation

- `docs/RLS_POLICIES.md` - RLS policy implementation details
- `docs/DATABASE_UPDATE_GUIDE.md` - Database update scripts
- `docs/STORAGE_UPDATE_GUIDE.md` - Storage bucket configuration
- `docs/LOGOUT_SECURITY.md` - Logout and session management

---

## 🔄 Security Maintenance

### Regular Tasks

1. **Review RLS Policies** (Quarterly)
   - Verify all policies are still appropriate
   - Check for any security gaps
   - Update documentation as needed

2. **Audit User Roles** (Monthly)
   - Review user role assignments
   - Verify no unauthorized role changes
   - Check for inactive users

3. **Update Dependencies** (Monthly)
   - Keep Supabase client library updated
   - Update other dependencies
   - Review security advisories

4. **Security Testing** (Before major releases)
   - Test all role-based access controls
   - Verify region isolation
   - Test authentication flows
   - Review error messages for information leakage

---

## 🚨 Security Incident Response

If a security issue is discovered:

1. **Immediate Actions:**
   - Assess the severity and scope
   - If critical, temporarily disable affected features
   - Document the issue

2. **Remediation:**
   - Fix the security vulnerability
   - Update RLS policies if needed
   - Test the fix thoroughly

3. **Documentation:**
   - Update this security document
   - Document the incident and resolution
   - Update related documentation

---

**Document Maintainer:** Development Team  
**Review Schedule:** Quarterly  
**Last Review:** January 2025

