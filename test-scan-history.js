require("dotenv").config();
const { supabase } = require("./supabase-client");

async function testScanHistory() {
  console.log("🔍 Testing scan history table...");
  
  try {
    // Test 1: Check if we can connect to Supabase
    console.log("1. Testing Supabase connection...");
    const { data: testData, error: testError } = await supabase
      .from("scan_history")
      .select("count")
      .limit(1);
    
    if (testError) {
      console.error("❌ Database connection error:", {
        code: testError.code,
        message: testError.message,
        details: testError.details,
        hint: testError.hint
      });
      
      if (testError.code === "42P01") {
        console.log("📋 Table 'scan_history' does not exist. Creating it...");
        await createScanHistoryTable();
      } else {
        console.error("❌ Other database error:", testError);
      }
    } else {
      console.log("✅ Database connection successful");
      console.log("✅ scan_history table exists");
    }
    
  } catch (error) {
    console.error("❌ Unexpected error:", error);
  }
}

async function createScanHistoryTable() {
  try {
    console.log("🔨 Creating scan_history table...");
    
    // Create the table using SQL
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS scan_history (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          spotify_playlist_url TEXT NOT NULL,
          spotify_playlist_name TEXT,
          found_tracks_count INTEGER DEFAULT 0,
          missing_tracks_count INTEGER DEFAULT 0,
          total_tracks INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (error) {
      console.error("❌ Error creating table:", error);
      console.log("💡 You may need to create the table manually in your Supabase dashboard");
      console.log("💡 Use the SQL from scan_history_schema.sql");
    } else {
      console.log("✅ scan_history table created successfully");
    }
    
  } catch (error) {
    console.error("❌ Error in createScanHistoryTable:", error);
  }
}

testScanHistory(); 