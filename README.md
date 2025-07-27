# CrateMatch Web App

A web version of CrateMatch that converts Spotify playlists to Serato crates using the same MLT.js library as the desktop app.

## Features

- 🔐 **User Authentication** - Sign up with email and get a 7-day free trial
- 💾 **Persistent Storage** - Your Serato database is stored securely in Supabase
- 🎵 **Spotify Integration** - Import any public Spotify playlist
- 📁 **Serato Crate Generation** - Download .crate files ready for Serato
- 🎯 **Smart Matching** - Configurable threshold for track matching
- 📱 **Responsive Design** - Works on desktop and mobile devices

## Prerequisites

- Node.js 18+ (20+ recommended for Supabase)
- A Supabase account and project
- Spotify API credentials (optional, for enhanced features)

## Setup

### 1. Clone and Install

```bash
cd webapp
npm install
```

### 2. Supabase Configuration

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Copy `env.example` to `.env` and fill in your Supabase credentials:

```bash
cp env.example .env
```

Edit `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
WEBAPP_URL=http://localhost:3000
PORT=3000
```

### 3. Supabase Database Setup

You need to create the `machines` table in your Supabase database. Run this SQL in your Supabase SQL editor:

```sql
-- Create machines table for user management
CREATE TABLE IF NOT EXISTS machines (
  id TEXT PRIMARY KEY,
  user_id UUID,
  email TEXT,
  role TEXT DEFAULT 'free',
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  subscription_status TEXT DEFAULT 'trial',
  subscription_type TEXT,
  subscription_start TIMESTAMP WITH TIME ZONE,
  subscription_end TIMESTAMP WITH TIME ZONE,
  exports_today INTEGER DEFAULT 0,
  last_export_date DATE,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to access only their own data
-- For web users: check if user_id matches auth.uid()
-- For desktop users: check if id matches the machine ID
CREATE POLICY "Users can view own machine data" ON machines
  FOR SELECT USING (
    auth.uid()::text = user_id::text OR
    auth.uid()::text = id
  );

CREATE POLICY "Users can insert own machine data" ON machines
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id::text OR
    auth.uid()::text = id
  );

CREATE POLICY "Users can update own machine data" ON machines
  FOR UPDATE USING (
    auth.uid()::text = user_id::text OR
    auth.uid()::text = id
  );
```

### 4. Supabase Storage Setup

1. Go to Storage in your Supabase dashboard
2. Create a new bucket called `cratematch-files`
3. Set the bucket to private
4. Create a storage policy to allow authenticated users to upload/download:

```sql
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'cratematch-files' AND auth.role() = 'authenticated');

-- Allow users to download their own files
CREATE POLICY "Users can download own files" ON storage.objects
  FOR SELECT USING (bucket_id = 'cratematch-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own files
CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE USING (bucket_id = 'cratematch-files' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### 5. Authentication Setup

1. Go to Authentication > Settings in your Supabase dashboard
2. Enable Email auth provider
3. Configure email templates (optional)
4. Set your site URL to `http://localhost:3000` for development

## Running the App

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Production

```bash
npm start
```

## Usage

### 1. Sign Up

- Visit the app and click "Sign Up"
- Enter your email and create a password
- Verify your email (check spam folder)
- You'll get a 7-day free trial automatically

### 2. Upload Database

- Sign in to your account
- Upload your Serato "database V2" file
- The file is stored securely in your account
- You won't need to re-upload it for future sessions

### 3. Process Playlist

- Paste a Spotify playlist URL
- Adjust the match threshold (50-100%)
- Click "Process Playlist"
- Wait for processing to complete

### 4. Download Crate

- If matches are found, download the .crate file
- Import the .crate file into Serato
- Your tracks will be organized in a new crate

## File Locations

Your Serato database file is typically located at:

- **macOS**: `~/Music/_Serato_/database V2`
- **Windows**: `C:\Users\[YourName]\Music\_Serato_\database V2`

## Subscription

- **Free Trial**: 7 days with full functionality
- **Paid Plans**: Monthly, yearly, and lifetime options available
- **Features**: Unlimited exports, 1000+ track playlists, import history

## Troubleshooting

### Common Issues

1. **"Missing Supabase environment variables"**

   - Check your `.env` file exists and has correct values
   - Restart the server after changing environment variables

2. **"Authentication required"**

   - Make sure you're signed in
   - Clear browser cache and try again

3. **"Upload failed"**

   - Check your internet connection
   - Try a smaller database file
   - Ensure you have an active subscription

4. **"Processing failed"**
   - Verify the Spotify playlist URL is correct
   - Check that the playlist is public
   - Try a smaller playlist first

### Support

For issues related to:

- **Web App**: Check this README and GitHub issues
- **Desktop App**: Contact the main CrateMatch support
- **MLT.js Library**: Check the MLT.js repository

## Development

### Project Structure

```
webapp/
├── public/           # Frontend files
│   ├── index.html    # Main app page
│   ├── auth.html     # Authentication page
│   ├── styles.css    # Styles
│   ├── script.js     # Main app logic
│   └── auth.js       # Authentication logic
├── server.js         # Express server
├── supabase-client.js # Supabase operations
├── auth-middleware.js # Authentication middleware
├── uploads/          # Temporary file storage
├── crates/           # Generated crate files
└── package.json      # Dependencies
```

### Key Dependencies

- `@musiclibrarytools/mlt.js` - Core playlist processing
- `@supabase/supabase-js` - Authentication and storage
- `express` - Web server
- `multer` - File upload handling

### Environment Variables

| Variable            | Description               | Required           |
| ------------------- | ------------------------- | ------------------ |
| `SUPABASE_URL`      | Your Supabase project URL | Yes                |
| `SUPABASE_ANON_KEY` | Your Supabase anon key    | Yes                |
| `WEBAPP_URL`        | Your app's URL            | Yes                |
| `PORT`              | Server port               | No (default: 3000) |

## License

This web app is part of the CrateMatch project. See the main repository for license information.
