-- Recall v0.1 Database Schema
-- Migration for contractor/pro Case and Log tracking

-- Create recall_cases table
CREATE TABLE recall_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  client_name TEXT,
  location_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create recall_logs table
CREATE TABLE recall_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES recall_cases(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_type TEXT NOT NULL DEFAULT 'General',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint to ensure valid log types
  CONSTRAINT valid_log_types CHECK (log_type IN ('Before', 'During', 'After', 'Issue', 'Resolution', 'Call', 'Visit', 'General'))
);

-- Create recall_photos table
CREATE TABLE recall_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id UUID NOT NULL REFERENCES recall_logs(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_recall_cases_owner_id ON recall_cases(owner_id);
CREATE INDEX idx_recall_cases_updated_at ON recall_cases(updated_at DESC);
CREATE INDEX idx_recall_logs_case_id ON recall_logs(case_id);
CREATE INDEX idx_recall_logs_owner_id ON recall_logs(owner_id);
CREATE INDEX idx_recall_logs_created_at ON recall_logs(created_at DESC);
CREATE INDEX idx_recall_photos_log_id ON recall_photos(log_id);
CREATE INDEX idx_recall_photos_owner_id ON recall_photos(owner_id);

-- Create GIN index for full-text search on notes
CREATE INDEX idx_recall_logs_note_search ON recall_logs USING gin(to_tsvector('english', note));
CREATE INDEX idx_recall_cases_title_search ON recall_cases USING gin(to_tsvector('english', title || ' ' || COALESCE(client_name, '')));

-- Create updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_recall_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_recall_cases_updated_at 
  BEFORE UPDATE ON recall_cases 
  FOR EACH ROW 
  EXECUTE FUNCTION update_recall_updated_at_column();

CREATE TRIGGER update_recall_logs_updated_at 
  BEFORE UPDATE ON recall_logs 
  FOR EACH ROW 
  EXECUTE FUNCTION update_recall_updated_at_column();

-- Enable Row Level Security
ALTER TABLE recall_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE recall_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE recall_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recall_cases
CREATE POLICY "Users can manage their own cases" ON recall_cases
  FOR ALL USING (auth.uid() = owner_id);

-- RLS Policies for recall_logs
CREATE POLICY "Users can manage their own logs" ON recall_logs
  FOR ALL USING (auth.uid() = owner_id);

-- RLS Policies for recall_photos
CREATE POLICY "Users can manage their own photos" ON recall_photos
  FOR ALL USING (auth.uid() = owner_id);

-- Storage bucket setup (run this in Supabase dashboard or via API)
-- CREATE BUCKET IF NOT EXISTS 'recall' WITH (public = false);
-- 
-- Storage policies for private recall bucket:
-- INSERT policy: Allow authenticated users to upload to their own folders
-- SELECT policy: Allow authenticated users to access their own files
-- UPDATE policy: Deny (files are immutable)
-- DELETE policy: Allow authenticated users to delete their own files