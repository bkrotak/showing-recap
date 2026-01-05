# Showing Recap MVP

A minimal web app for real estate agents to collect buyer feedback on property showings.

## Features

- **Agent Login**: Magic link authentication via Supabase Auth
- **Create Showings**: Simple form to capture buyer info, property details, and showing time
- **Public Feedback Links**: Unique URLs for buyers to provide feedback without login
- **Buyer Feedback**: Three-choice system (Interested/Maybe/Not for us) with notes and photos
- **Photo Uploads**: Up to 10 photos per showing stored in Supabase Storage
- **Agent Dashboard**: View all showings and their feedback status

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Security**: Row Level Security (RLS) policies

## Environment Variables

Copy `.env.local` and update with your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Setup Instructions

### 1. Create Supabase Project
- Go to [supabase.com](https://supabase.com)
- Create new project (note: may take 2-3 minutes)
- Note your project URL and API keys from Settings > API

### 2. Configure Database
- In Supabase dashboard, go to SQL Editor
- Copy and paste the entire contents of `supabase-schema.sql`
- Click "Run" to execute the schema
- Verify tables are created in Table Editor

### 3. Create Storage Bucket
- Go to Storage in Supabase dashboard
- Create a new bucket named `showing-photos`
- Set bucket to **Public** (important for photo viewing)
- Configure upload policies (already handled by RLS)

### 4. Configure Environment Variables
- Copy `.env.local` to `.env.local.backup`
- Edit `.env.local` with your actual Supabase values:
  ```bash
  NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```

### 5. Install and Run
```bash
npm install
npm run dev
```

### 6. Test the Application
1. Visit http://localhost:3000 (should redirect to login)
2. Enter your email for magic link authentication
3. Check email and click the magic link
4. Create a test showing with future date/time
5. Copy the buyer link and test feedback submission
6. View the showing details in the dashboard

### 7. Optional: Configure Twilio SMS (Prompt F Add-on)

To enable SMS notifications when creating showings:

1. **Create Twilio Account**
   - Sign up at [twilio.com](https://www.twilio.com)
   - Get a phone number from Twilio Console
   - Note your Account SID, Auth Token, and Twilio phone number

2. **Add Twilio Environment Variables**
   ```bash
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_NUMBER=+1234567890
   ```

3. **SMS Features Available**
   - Toggle "Send SMS to buyer" when creating showings
   - Custom SMS message (or use default template)
   - "Send SMS Reminder" button in showing detail view
   - Automatic error handling for invalid numbers

**Note**: SMS is completely optional. The app works fully without Twilio configuration.

## Usage

1. **Agent Login**: Visit `/login` and enter email for magic link
2. **Create Showing**: Use `/dashboard/new` to create showing and get public link
3. **Share Link**: Send public recap URL to buyer
4. **Collect Feedback**: Buyer uses public link to submit feedback and photos
5. **View Results**: Check dashboard for all showing feedback

## File Structure

```
app/
├── login/page.tsx          # Agent login page
├── dashboard/
│   ├── page.tsx           # Dashboard listing
│   └── new/page.tsx       # Create showing form
├── r/[token]/page.tsx     # Public buyer recap page
└── layout.tsx             # Root layout

lib/
├── supabase.ts            # Supabase client config
└── types.ts               # TypeScript definitions
```

## Troubleshooting

**Build Errors**: Ensure all environment variables are set correctly before running `npm run build`

**Auth Issues**: Check that magic link emails aren't going to spam folder

**Photo Upload Issues**: Verify the `showing-photos` bucket exists and is set to Public

**Database Errors**: Confirm the entire `supabase-schema.sql` was executed without errors

## MVP Status: ✅ Complete + SMS Add-on

This MVP includes all specified features plus Twilio SMS integration:
- ✅ Agent authentication (magic link)
- ✅ Create showings with secure public tokens
- ✅ Public buyer feedback page (no login required)
- ✅ Photo uploads (up to 10 per showing)
- ✅ Agent dashboard with showing list
- ✅ Detailed showing view with photo gallery
- ✅ Row Level Security (RLS) policies
- ✅ Responsive design (mobile-friendly)
- ✅ Form validation and error handling
- ✅ **Twilio SMS integration (Prompt F)**
  - Toggle to send SMS when creating showing
  - Custom SMS message support
  - SMS reminder button in showing details
  - Comprehensive error handling

**Not Implemented** (per MVP constraints):
- ❌ MLS/IDX integration
- ❌ ShowingTime API
- ❌ Email parsing or scraping
- ❌ Transaction management
- ❌ Payment processing
