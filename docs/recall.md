# Recall v0.1 - Case Management for Contractors

Recall is a mobile-first case and log management system built for contractors, service professionals, and anyone who needs to document work with photos and notes.

## What is Recall?

Recall allows you to:
- 📋 **Create Cases** - Track jobs, projects, or properties
- 📝 **Add Logs** - Document work with timestamped notes and photos  
- 📷 **Capture Photos** - Camera-first mobile interface for quick documentation
- 🔍 **Search & Browse** - Find cases and logs quickly
- 📄 **Export PDFs** - Generate professional reports
- 📦 **Download Photos** - Get ZIP archives organized by date and log type
- 🗑️ **Manage Storage** - Delete cloud photos after local backup

## Features

### Mobile-First Design
- Large, thumb-friendly buttons
- Camera capture with environment setting
- Optimized for portrait phone use
- Add to home screen support (PWA)

### Secure Data Storage  
- Private Supabase storage bucket
- Row Level Security (RLS) policies
- Signed URLs for photo access
- You own and control all data

### Flexible Organization
- Log types: Before, During, After, Issue, Resolution, Call, Visit, General
- Full-text search across cases and notes
- Chronological log ordering
- Photo thumbnails and galleries

### Export & Backup
- PDF case reports with photo thumbnails
- ZIP downloads organized by log and date
- Individual photo downloads
- Cloud photo deletion after local backup

## Setup Instructions

### 1. Database Setup

Run the migration in your Supabase SQL Editor:

```sql
-- Copy and paste the contents of supabase/migrations/20260105_recall.sql
```

This creates:
- `recall_cases` table
- `recall_logs` table  
- `recall_photos` table
- Indexes and triggers
- Row Level Security policies

### 2. Storage Bucket Setup

In your Supabase dashboard:

1. Go to **Storage**
2. Click **"New bucket"**
3. Name: `recall`
4. **Make it Private** (uncheck public)
5. Click **"Create bucket"**

### 3. Storage Policies

Set up these policies for the `recall` bucket:

**INSERT Policy:**
- Name: `Authenticated users can upload to own folders`
- Target roles: `authenticated`
- USING expression: `true`
- WITH CHECK: `true`

**SELECT Policy:**  
- Name: `Authenticated users can view own files`
- Target roles: `authenticated`
- USING expression: `true`

**DELETE Policy:**
- Name: `Authenticated users can delete own files`  
- Target roles: `authenticated`
- USING expression: `true`

### 4. Environment Variables

Your existing `.env.local` should work. Recall uses the same Supabase config as the showing-recap feature:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key  
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### 5. Authentication

Recall reuses the existing authentication system. Users must log in via the `/login` route before accessing `/recall` routes.

## Usage Guide

### Creating Your First Case

1. Go to `/recall`
2. Tap **"New Case"**
3. Enter title (required), client name, and location
4. Tap **"Create Case"**

### Adding Logs with Photos

1. From case detail, tap **"Add Log"**
2. Select log type (Before, During, After, etc.)
3. Add notes describing the work
4. Tap **"Add Photos"** to capture or select images
5. Review thumbnails and remove unwanted photos
6. Tap **"Save Log"**

### Exporting Data

**PDF Reports:**
- From case detail, tap **"Export PDF"**
- Includes case info, all logs, and photo thumbnails
- Downloads directly to device

**Photo Archives:**
- **Case Level:** Downloads all photos organized by log and date
- **Log Level:** Downloads photos from a specific log
- Files organized in folders with timestamps

### Managing Storage

**Local Downloads:**
- Export important cases as PDF + ZIP before deletion
- Download photos you want to keep permanently

**Cloud Cleanup:**
- Delete individual photos from log detail page
- Delete all photos from a log with confirmation
- Delete entire cases with all associated data

## Mobile "Add to Home Screen" Setup

### iOS (Safari)
1. Open `/recall` in Safari
2. Tap the share button (square with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. Customize name and tap **"Add"**

### Android (Chrome)  
1. Open `/recall` in Chrome
2. Tap the menu button (⋮)
3. Tap **"Add to Home screen"**
4. Customize name and tap **"Add"**

## Direct Supabase Dashboard Access

You can also manage your data directly:

1. Go to your Supabase project dashboard
2. **Storage Tab:** Browse and download files from the `recall` bucket
3. **Database Tab:** Query tables directly if needed
4. **File Structure:** `recall_cases/{case-id}/logs/{log-id}/photo-files`

## Storage Retention Best Practices

### Regular Backups
- Export critical cases monthly as PDF + ZIP
- Keep local copies of important project documentation
- Consider automated backup scripts for high-volume use

### Cloud Storage Management
- Delete cloud photos after confirming local downloads
- Archive old cases to reduce storage costs
- Use clear naming conventions for easy organization

### Data Ownership
- All data stored in YOUR Supabase project
- No vendor lock-in - you control the database and storage
- Export capabilities ensure data portability

## Technical Details

### Tech Stack
- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Storage + Auth)
- **Export:** jsPDF for reports, JSZip for archives
- **Security:** Row Level Security, signed URLs, private storage

### File Limits
- **Photos per log:** 8 maximum
- **File size:** 5MB per photo
- **File types:** Images only (JPG, PNG, etc.)
- **Storage:** Private bucket with signed URL access

### Performance Features
- Lazy loading of photo URLs
- Compressed image previews
- Efficient database queries with proper indexing
- Full-text search on notes and case titles

## Troubleshooting

### "Storage bucket not found"
- Create the `recall` bucket in Supabase Storage
- Ensure it's set to private (not public)
- Check storage policies are configured

### "Failed to upload photos"  
- Check file size (must be < 5MB each)
- Verify file type (images only)
- Ensure stable internet connection
- Check Supabase storage quotas

### "Photos not loading"
- Storage bucket may be misconfigured
- Check RLS policies allow authenticated access
- Verify signed URL generation is working

### Authentication issues
- Ensure user is logged in via `/login`
- Check Supabase auth configuration
- Verify RLS policies reference `auth.uid()`

## API Reference

### Database Tables

**recall_cases:**
- `id` (UUID, PK)
- `owner_id` (UUID, FK to auth.users)  
- `title` (Text, required)
- `client_name` (Text, optional)
- `location_text` (Text, optional)
- `created_at`, `updated_at` (Timestamps)

**recall_logs:**
- `id` (UUID, PK)
- `case_id` (UUID, FK)
- `owner_id` (UUID, FK to auth.users)
- `log_type` (Enum: Before|During|After|Issue|Resolution|Call|Visit|General)
- `note` (Text, default empty)
- `created_at`, `updated_at` (Timestamps)

**recall_photos:**  
- `id` (UUID, PK)
- `log_id` (UUID, FK)
- `owner_id` (UUID, FK to auth.users)
- `storage_path` (Text, S3-style path)
- `original_filename` (Text, optional)
- `created_at` (Timestamp)

### Storage Structure
```
recall/
  recall_cases/
    {case-uuid}/
      logs/
        {log-uuid}/
          {photo-uuid}.jpg
          {photo-uuid}.png
```

## Support

For issues or questions:
1. Check this documentation
2. Verify Supabase configuration  
3. Test with browser dev tools console
4. Check Supabase dashboard logs

---

**Recall v0.1** - Built for contractors who need simple, reliable work documentation.