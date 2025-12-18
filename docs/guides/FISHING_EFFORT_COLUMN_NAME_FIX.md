# Fishing Effort Column Name Fix

## Issue

The error indicates that the column name in the database doesn't match what's being used in the code. PostgreSQL/Supabase converts unquoted identifiers to lowercase.

**Error:**
```
column dbo_fishing_effort.UnitEffort_id does not exist
hint: 'Perhaps you meant to reference the column "dbo_fishing_effort.uniteffort_id".'
```

## Solution

The column name in your database is `uniteffort_id` (all lowercase), not `UnitEffort_ID` or `UnitEffort_id`. This happens because PostgreSQL converts unquoted identifiers to lowercase.

### Option 1: Update the Database Column Name (Recommended)

If you want to use `UnitEffort_ID` consistently, rename the column in the database:

```sql
-- Rename the column to match the expected name
ALTER TABLE public.dbo_fishing_effort 
RENAME COLUMN "UnitEffort_id" TO "UnitEffort_ID";
```

Or if it's lowercase:
```sql
ALTER TABLE public.dbo_fishing_effort 
RENAME COLUMN uniteffort_id TO "UnitEffort_ID";
```

### Option 2: Update the Code (Already Done)

The code has been updated to use `uniteffort_id` (all lowercase) to match your database. All queries now use:
- `.order('uniteffort_id', { ascending: true })`
- `.eq('uniteffort_id', id)`

And the code includes a helper function `getEffortId()` that handles different case variations:
- `record.uniteffort_id || record.UnitEffort_id || record.UnitEffort_ID || record.UnitEffortId`

### Check Your Actual Column Name

Run this query in Supabase SQL Editor to see the exact column name:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'dbo_fishing_effort'
ORDER BY ordinal_position;
```

### Best Practice

To avoid case sensitivity issues in the future:

1. **Use quotes when creating columns** to preserve exact case:
```sql
CREATE TABLE public.dbo_fishing_effort (
    "UnitEffort_ID" SERIAL PRIMARY KEY,  -- Quotes preserve case
    fishing_effort TEXT NOT NULL
);
```

2. **Or use all lowercase** (PostgreSQL default):
```sql
CREATE TABLE public.dbo_fishing_effort (
    uniteffort_id SERIAL PRIMARY KEY,  -- No quotes = lowercase
    fishing_effort TEXT NOT NULL
);
```

3. **Be consistent** - Use the same case in all queries and code.

---

**Status:** Code updated to use `uniteffort_id` (all lowercase) to match the database.

