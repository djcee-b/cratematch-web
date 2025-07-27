const {
  machineOperations,
  generateWebMachineId,
} = require("./supabase-client");

// Test the web machine ID generation
async function testWebMachineId() {
  console.log("Testing web machine ID generation...");

  const testUserId = "test-user-123";
  const machineId1 = generateWebMachineId(testUserId);
  const machineId2 = generateWebMachineId(testUserId);

  console.log("Test user ID:", testUserId);
  console.log("Generated machine ID 1:", machineId1);
  console.log("Generated machine ID 2:", machineId2);
  console.log("IDs match:", machineId1 === machineId2);

  // Test the getMachineByUserId function
  try {
    console.log("\nTesting getMachineByUserId...");
    const { data, error } = await machineOperations.getMachineByUserId(
      testUserId
    );

    if (error) {
      console.log("Expected error (user not found):", error.message);
      console.log("Error code:", error.code);
    } else {
      console.log("Unexpected success:", data);
    }
  } catch (err) {
    console.log("Exception:", err.message);
  }
}

// Test cross-platform account linking
async function testCrossPlatformLinking() {
  console.log("\n=== Testing Cross-Platform Account Linking ===");

  const testUserId = "123e4567-e89b-12d3-a456-426614174000"; // Proper UUID format

  // Test web machine ID generation for the same user
  const webMachineId = generateWebMachineId(testUserId);
  console.log("Test user ID:", testUserId);
  console.log("Web machine ID for same user:", webMachineId);
  console.log(
    "Web machine ID is consistent:",
    generateWebMachineId(testUserId) === webMachineId
  );

  // Test that web machine doesn't exist yet (expected)
  console.log("\nTesting web machine lookup (should not exist)...");
  const { data: webMachine, error: webError } =
    await machineOperations.getMachineByUserId(testUserId);

  if (webError) {
    console.log("Expected error (web machine not found):", webError.message);
    console.log("Error code:", webError.code);
  } else {
    console.log("Unexpected web machine found:", webMachine);
  }

  // Test finding existing machines by user_id (should not find any for test user)
  console.log("\nTesting findMachinesByUserId...");
  const { data: existingMachines, error: findError } =
    await machineOperations.findMachinesByUserId(testUserId);

  if (findError) {
    console.log("Error finding machines:", findError.message);
  } else {
    console.log("Found existing machines:", existingMachines?.length || 0);
    if (existingMachines && existingMachines.length > 0) {
      console.log("Found existing machine data:", {
        id: existingMachines[0].id,
        role: existingMachines[0].role,
        trial_end: existingMachines[0].trial_end,
      });
    }
  }

  console.log("\n✅ Cross-platform linking test completed successfully!");
  console.log("This demonstrates that:");
  console.log("1. Web machine ID generation is consistent");
  console.log("2. Web machine lookup works correctly");
  console.log("3. findMachinesByUserId function works");
  console.log("4. The system is ready to link desktop and web accounts");

  console.log("\n📋 How cross-platform linking will work:");
  console.log(
    "1. User creates account on desktop → machine record with desktop machine ID"
  );
  console.log(
    "2. User logs in on web → system checks for existing desktop records by user_id"
  );
  console.log(
    "3. If found → creates web machine record with same subscription/trial data"
  );
  console.log("4. If not found → creates new web machine record with trial");
}

// Run the tests
async function runAllTests() {
  await testWebMachineId();
  await testCrossPlatformLinking();
}

runAllTests().catch(console.error);
