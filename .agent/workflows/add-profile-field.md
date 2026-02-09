---
description: How to add a new profile field for workers or employers
---

# Adding a New Profile Field

When adding a new field to worker or employer profiles, follow these steps to ensure the field is fully integrated and users are notified.

## Steps

### 1. Add Column to Supabase
Run a migration or add the column directly in the Supabase dashboard.
```sql
ALTER TABLE candidates ADD COLUMN new_field TEXT;
-- or for employers:
ALTER TABLE employers ADD COLUMN new_field TEXT;
```

### 2. Update the Profile Form UI
- **Workers:** Edit `src/app/profile/worker/page.tsx` — add the input field to the form and include it in the save/update handler.
- **Employers:** Edit `src/app/profile/employer/EmployerProfileClient.tsx` — add the field to `companyForm` state, the form UI, and the save handler.

### 3. Update Profile Completion Logic
Add the new field to the completion calculation so it counts toward the percentage:
- **Workers:** `src/app/profile/worker/page.tsx` → the `fields` array inside `calculateCompletion`
- **Employers:** `src/app/profile/employer/EmployerProfileClient.tsx` → the `required` array inside `calculateCompletion`

### 4. Update Admin Workers List Completion
- `src/app/admin/workers/page.tsx` → update the `fields` array inside `getUserStats` to include the new field.

### 5. Update the Cron Job Field Maps
Edit `src/app/api/cron/check-incomplete-profiles/route.ts`:
- Add the field to `WORKER_FIELD_LABELS` or `EMPLOYER_FIELD_LABELS` (with a human-readable label).
- Add the field to the worker/employer completion check logic inside the `GET` handler.

// turbo
### 6. Deploy and Trigger
After deploying, the cron job (`/api/cron/check-incomplete-profiles`) runs daily at 10 AM UTC. It will automatically detect users missing the new field and send them a `profile_incomplete` email listing what they need to fill in. No manual email sending needed.

### 7. (Optional) Trigger Immediately
If you don't want to wait for the next cron run:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://workersunited.eu/api/cron/check-incomplete-profiles
```
