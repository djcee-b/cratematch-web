// Test script for scan details functionality
const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client (you'll need to add your credentials)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testScanDetails() {
  console.log("🧪 Testing scan details functionality...\n");

  try {
    // Test 1: Check if scan_history table exists
    console.log("1. Checking scan_history table...");
    const { data: scanHistory, error: scanError } = await supabase
      .from("scan_history")
      .select("*")
      .limit(1);

    if (scanError) {
      console.log("❌ scan_history table error:", scanError.message);
    } else {
      console.log("✅ scan_history table accessible");
    }

    // Test 2: Check if scan_tracks table exists
    console.log("\n2. Checking scan_tracks table...");
    const { data: scanTracks, error: tracksError } = await supabase
      .from("scan_tracks")
      .select("*")
      .limit(1);

    if (tracksError) {
      console.log("❌ scan_tracks table error:", tracksError.message);
    } else {
      console.log("✅ scan_tracks table accessible");
    }

    // Test 3: Check table structure
    console.log("\n3. Checking table structure...");

    // Get scan_history columns
    const { data: scanColumns, error: scanColError } = await supabase
      .rpc("get_table_columns", { table_name: "scan_history" })
      .catch(() => ({ data: null, error: "RPC not available" }));

    if (scanColError) {
      console.log("ℹ️  Could not get scan_history columns (RPC not available)");
    } else {
      console.log("✅ scan_history columns:", scanColumns);
    }

    // Get scan_tracks columns
    const { data: tracksColumns, error: tracksColError } = await supabase
      .rpc("get_table_columns", { table_name: "scan_tracks" })
      .catch(() => ({ data: null, error: "RPC not available" }));

    if (tracksColError) {
      console.log("ℹ️  Could not get scan_tracks columns (RPC not available)");
    } else {
      console.log("✅ scan_tracks columns:", tracksColumns);
    }

    console.log("\n✅ Scan details functionality test completed!");
    console.log("\n📋 Summary:");
    console.log("- scan_history table: " + (scanError ? "❌ Error" : "✅ OK"));
    console.log("- scan_tracks table: " + (tracksError ? "❌ Error" : "✅ OK"));

    if (!scanError && !tracksError) {
      console.log("\n🎉 Both tables are ready for scan details functionality!");
      console.log("\n📝 Next steps:");
      console.log(
        "1. Run the database migration: psql -d your_database -f scan_history_schema.sql"
      );
      console.log("2. Restart your server");
      console.log("3. Test the functionality in the web app");
    } else {
      console.log(
        "\n⚠️  Some tables may need to be created. Check the errors above."
      );
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testScanDetails();
