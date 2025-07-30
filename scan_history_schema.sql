-- Create scan_history table
CREATE TABLE scan_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  spotify_playlist_url TEXT NOT NULL,
  spotify_playlist_name TEXT,
  found_tracks_count INTEGER DEFAULT 0,
  missing_tracks_count INTEGER DEFAULT 0,
  total_tracks INTEGER DEFAULT 0,
  scan_results JSONB, -- Store complete results as JSON for backward compatibility
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scan_tracks table to store detailed track results
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

-- Create RLS policies
ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_tracks ENABLE ROW LEVEL SECURITY;

-- Users can only see their own scan history
CREATE POLICY "Users can view own scan history" ON scan_history
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own scan history
CREATE POLICY "Users can insert own scan history" ON scan_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own scan history
CREATE POLICY "Users can update own scan history" ON scan_history
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own scan history
CREATE POLICY "Users can delete own scan history" ON scan_history
  FOR DELETE USING (auth.uid() = user_id);

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

-- Add indexes for faster queries
CREATE INDEX idx_scan_history_user_created ON scan_history(user_id, created_at DESC);
CREATE INDEX idx_scan_tracks_scan_id ON scan_tracks(scan_id);
CREATE INDEX idx_scan_tracks_is_found ON scan_tracks(is_found);
CREATE INDEX idx_scan_history_results ON scan_history USING GIN (scan_results);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_scan_history_updated_at 
    BEFORE UPDATE ON scan_history 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 