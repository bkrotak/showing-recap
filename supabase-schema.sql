-- Showing Recap MVP Database Schema
-- Use auth.users for agent authentication (built-in Supabase Auth)

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for feedback status
CREATE TYPE feedback_status AS ENUM ('INTERESTED', 'NOT_FOR_US', 'MAYBE');

-- Showings table
CREATE TABLE showings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  public_token UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  
  -- Buyer information
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT NOT NULL, -- E.164 format
  buyer_email TEXT,
  
  -- Property information
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  showing_datetime TIMESTAMPTZ NOT NULL,
  
  -- Feedback (embedded in showings table for simplicity)
  feedback_status feedback_status,
  feedback_note TEXT CHECK (LENGTH(feedback_note) <= 280),
  feedback_submitted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Showing photos metadata
CREATE TABLE showing_photos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  showing_id UUID REFERENCES showings(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL, -- Path in Supabase Storage: showing_id/<uuid>.jpg
  original_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_showings_agent_id ON showings(agent_id);
CREATE INDEX idx_showings_public_token ON showings(public_token);
CREATE INDEX idx_showings_created_at ON showings(created_at DESC);
CREATE INDEX idx_showing_photos_showing_id ON showing_photos(showing_id);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for showings updated_at
CREATE TRIGGER update_showings_updated_at 
  BEFORE UPDATE ON showings 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE showings ENABLE ROW LEVEL SECURITY;
ALTER TABLE showing_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for showings table

-- Authenticated agents can CRUD their own showings
CREATE POLICY "Agents can manage own showings" ON showings
  FOR ALL USING (auth.uid() = agent_id);

-- Anonymous users can SELECT showing by public_token (minimal fields only)
CREATE POLICY "Public can view showing by token" ON showings
  FOR SELECT USING (true); -- We'll filter by public_token in application code

-- Anonymous users can UPDATE feedback for showing by public_token
-- Note: We use the security definer function for updates instead of direct UPDATE policy
CREATE POLICY "Public can update feedback by token" ON showings
  FOR UPDATE USING (false); -- Disable direct updates, use function instead

-- RLS Policies for showing_photos table

-- Authenticated agents can view photos for their showings
CREATE POLICY "Agents can view photos for own showings" ON showing_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM showings 
      WHERE showings.id = showing_photos.showing_id 
      AND showings.agent_id = auth.uid()
    )
  );

-- Anonymous users can INSERT photos for showing by public_token
CREATE POLICY "Public can upload photos by token" ON showing_photos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM showings 
      WHERE showings.id = showing_photos.showing_id 
      AND showings.public_token IS NOT NULL
    )
  );

-- Anonymous users can view photos for showing by public_token
CREATE POLICY "Public can view photos by token" ON showing_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM showings 
      WHERE showings.id = showing_photos.showing_id
    )
  );

-- Security definer function for public feedback updates
-- This ensures proper validation of public_token while allowing anonymous updates
CREATE OR REPLACE FUNCTION update_showing_feedback(
  token UUID,
  status feedback_status,
  note TEXT DEFAULT NULL
) RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate note length
  IF note IS NOT NULL AND LENGTH(note) > 280 THEN
    RAISE EXCEPTION 'Note exceeds 280 character limit';
  END IF;
  
  -- Update showing feedback
  UPDATE showings 
  SET 
    feedback_status = status,
    feedback_note = note,
    feedback_submitted_at = NOW()
  WHERE public_token = token;
  
  -- Return true if row was updated
  RETURN FOUND;
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION update_showing_feedback(UUID, feedback_status, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION update_showing_feedback(UUID, feedback_status, TEXT) TO authenticated;

-- Storage bucket policies (to be applied in Supabase dashboard)
-- Bucket name: "showing-photos"
-- Path structure: showing_id/<uuid>.<ext>
-- 
-- INSERT policy: Allow uploads for valid showing public_tokens
-- SELECT policy: Allow public read access
-- UPDATE/DELETE policies: Deny (photos are immutable once uploaded)