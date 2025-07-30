require("dotenv").config();
const { supabase } = require("./supabase-client");

async function testScanHistoryWithAuth() {
  console.log("🔍 Testing scan history with authentication...");
  
  try {
    // First, let's test if we can get a user session
    console.log("1. Testing authentication...");
    
    // Try to get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("❌ Session error:", sessionError);
      return;
    }
    
    if (!session) {
      console.log("⚠️  No active session found");
      console.log("💡 You need to be logged in to test scan history");
      return;
    }
    
    console.log("✅ Active session found for user:", session.user.email);
    console.log("User ID:", session.user.id);
    
    // Test 2: Try to query scan history for this user
    console.log("2. Testing scan history query...");
    const { data: scanHistory, error: queryError } = await supabase
      .from("scan_history")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (queryError) {
      console.error("❌ Query error:", {
        code: queryError.code,
        message: queryError.message,
        details: queryError.details,
        hint: queryError.hint
      });
    } else {
      console.log("✅ Query successful");
      console.log("📊 Found", scanHistory?.length || 0, "scan history records");
      
      if (scanHistory && scanHistory.length > 0) {
        console.log("📋 Sample record:", scanHistory[0]);
      }
    }
    
    // Test 3: Try to insert a test record
    console.log("3. Testing scan history insert...");
    const testData = {
      user_id: session.user.id,
      spotify_playlist_url: "https://open.spotify.com/playlist/test",
      spotify_playlist_name: "Test Playlist",
      found_tracks_count: 5,
      missing_tracks_count: 2,
      total_tracks: 7
    };
    
    const { data: newRecord, error: insertError } = await supabase
      .from("scan_history")
      .insert(testData)
      .select()
      .single();
    
    if (insertError) {
      console.error("❌ Insert error:", {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
    } else {
      console.log("✅ Insert successful");
      console.log("📝 New record:", newRecord);
      
      // Clean up - delete the test record
      const { error: deleteError } = await supabase
        .from("scan_history")
        .delete()
        .eq("id", newRecord.id);
      
      if (deleteError) {
        console.error("⚠️  Could not clean up test record:", deleteError);
      } else {
        console.log("🧹 Test record cleaned up");
      }
    }
    
  } catch (error) {
    console.error("❌ Unexpected error:", error);
  }
}

testScanHistoryWithAuth(); 