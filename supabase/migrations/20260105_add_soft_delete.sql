-- Add soft delete column to recall_cases
ALTER TABLE recall_cases ADD COLUMN deleted_at TIMESTAMPTZ NULL;

-- Create index for better performance when filtering out deleted cases
CREATE INDEX idx_recall_cases_deleted_at ON recall_cases(deleted_at) WHERE deleted_at IS NULL;

-- Update existing getCases queries will automatically exclude deleted cases with WHERE deleted_at IS NULL