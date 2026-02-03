# Workers United - Implementation Plan

## Overview
Complete website upgrade from legacy HTML to Next.js 16 with modern design.

## Phase 5: Admin Panel (NEXT)

### 5.1 Admin Dashboard
- File: `src/app/admin/page.tsx`
- Stats: total candidates, employers, pending verifications
- Recent activity feed

### 5.2 Candidates Management
- File: `src/app/admin/candidates/page.tsx`
- Table with filters (status, nationality)
- Search functionality
- View/edit individual profiles

### 5.3 Employers Management  
- File: `src/app/admin/employers/page.tsx`
- Table with company info
- View job requirements
- Filter by status

### 5.4 Verification Controls
- File: `src/app/admin/candidates/[id]/page.tsx`
- View uploaded documents
- Approve/reject buttons
- Add admin notes

### 5.5 Database Considerations
- Use Supabase service role for admin queries
- Check existing RLS policies
- Admin routes already exist at `/admin/*`

## Tech Stack
- Next.js 16.1.6
- Supabase (auth, db, storage)
- OpenAI GPT-4o (doc verification)
- Tailwind CSS
- Vercel deployment
