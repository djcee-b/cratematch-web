-- Update existing scan_history table to enable RLS (if not already enabled)
ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;

-- Create scan_tracks table to store detailed track information for each scan
CREATE TABLE scan_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID REFERENCES scan_history(id) ON DELETE CASCADE,
  spotify_track_name TEXT NOT NULL,
  spotify_artist_name TEXT NOT NULL,
  spotify_album_name TEXT,
  serato_track_name TEXT,
  serato_artist_name TEXT,
  serato_album_name TEXT,
  similarity_percentage DECIMAL(5,2),
  is_found BOOLEAN DEFAULT FALSE,
  variations JSONB, -- Store track variations as JSON
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on scan_tracks table
ALTER TABLE scan_tracks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for scan_tracks table
-- Users can only see scan tracks for their own scans
CREATE POLICY "Users can view own scan tracks" ON scan_tracks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM scan_history 
      WHERE scan_history.id = scan_tracks.scan_id 
      AND scan_history.user_id = auth.uid()
    )
  );

-- Users can insert scan tracks for their own scans
CREATE POLICY "Users can insert own scan tracks" ON scan_tracks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM scan_history 
      WHERE scan_history.id = scan_tracks.scan_id 
      AND scan_history.user_id = auth.uid()
    )
  );

-- Users can update scan tracks for their own scans
CREATE POLICY "Users can update own scan tracks" ON scan_tracks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM scan_history 
      WHERE scan_history.id = scan_tracks.scan_id 
      AND scan_history.user_id = auth.uid()
    )
  );

-- Users can delete scan tracks for their own scans
CREATE POLICY "Users can delete own scan tracks" ON scan_tracks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM scan_history 
      WHERE scan_history.id = scan_tracks.scan_id 
      AND scan_history.user_id = auth.uid()
    )
  );

-- Add indexes for faster queries on scan_tracks table
CREATE INDEX idx_scan_tracks_scan_id ON scan_tracks(scan_id);
CREATE INDEX idx_scan_tracks_is_found ON scan_tracks(is_found);

-- Add trigger function to update updated_at timestamp (if not already exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to update updated_at timestamp on scan_history (if not already exists)
DROP TRIGGER IF EXISTS update_scan_history_updated_at ON scan_history;
CREATE TRIGGER update_scan_history_updated_at 
    BEFORE UPDATE ON scan_history 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Verify the setup
SELECT 
  'scan_history' as table_name,
  COUNT(*) as row_count
FROM scan_history
UNION ALL
SELECT 
  'scan_tracks' as table_name,
  COUNT(*) as row_count
FROM scan_tracks; 