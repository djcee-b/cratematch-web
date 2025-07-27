const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
require("dotenv").config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Generate a web-specific machine ID for web users
function generateWebMachineId(userId) {
  // Create a consistent machine ID for web users based on their user ID
  // This ensures the same user always gets the same machine ID across sessions
  const hash = crypto
    .createHash("sha256")
    .update(`web-${userId}`)
    .digest("hex");
  return hash;
}

// Database operations for machines table
const machineOperations = {
  // Get machine by ID
  getMachine: async (machineId) => {
    const { data, error } = await supabase
      .from("machines")
      .select("*")
      .eq("id", machineId);

    // If no rows found, return null data instead of error
    if (error && error.code === "PGRST116") {
      return { data: null, error: null };
    }

    // If multiple rows found, return error
    if (data && data.length > 1) {
      return {
        data: null,
        error: { message: "Multiple machine records found for ID" },
      };
    }

    // Return single row or null
    return { data: data && data.length > 0 ? data[0] : null, error };
  },

  // Get machine by email (for web users)
  getMachineByEmail: async (email) => {
    const { data, error } = await supabase
      .from("machines")
      .select("*")
      .eq("email", email);

    // If no rows found, return null data instead of error
    if (error && error.code === "PGRST116") {
      return { data: null, error: null };
    }

    // If multiple rows found, return error
    if (data && data.length > 1) {
      return {
        data: null,
        error: { message: "Multiple machine records found for email" },
      };
    }

    // Return single row or null
    return { data: data && data.length > 0 ? data[0] : null, error };
  },

  // Get machine by user ID (for backward compatibility)
  getMachineByUserId: async (userId) => {
    // For backward compatibility, we'll get the user's email and find machine by email
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return { data: null, error: userError };
    }

    return machineOperations.getMachineByEmail(userData.user.email);
  },

  // Find existing machine records by user_id (for linking desktop accounts)
  findMachinesByUserId: async (userId) => {
    return supabase.from("machines").select("*").eq("user_id", userId);
  },

  // Find machine records by email (for web users)
  findMachinesByEmail: async (email) => {
    return supabase.from("machines").select("*").eq("email", email);
  },

  // Upsert machine (insert or update)
  upsertMachine: async (machineData) => {
    return supabase.from("machines").upsert(machineData, { onConflict: "id" });
  },

  // Update machine
  updateMachine: async (machineId, updates) => {
    return supabase.from("machines").update(updates).eq("id", machineId);
  },

  // Get user by machine ID (alias for getMachine)
  getUser: async (machineId) => {
    return machineOperations.getMachine(machineId);
  },
};

// Storage operations for database files
const storageOperations = {
  // Upload database file to Supabase storage
  uploadDatabase: async (userId, fileBuffer, fileName, accessToken = null) => {
    const filePath = `databases/${userId}/${fileName}`;

    // If access token is provided, create a new client with that token
    let client = supabase;
    if (accessToken) {
      const { createClient } = require("@supabase/supabase-js");
      client = createClient(supabaseUrl, supabaseKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });
    }

    const { data, error } = await client.storage
      .from("cratematch-files")
      .upload(filePath, fileBuffer, {
        contentType: "application/octet-stream",
        upsert: true,
      });

    if (error) throw error;
    return data;
  },

  // Download database file from Supabase storage
  downloadDatabase: async (userId, fileName, accessToken = null) => {
    const filePath = `databases/${userId}/${fileName}`;

    // If access token is provided, create a new client with that token
    let client = supabase;
    if (accessToken) {
      const { createClient } = require("@supabase/supabase-js");
      client = createClient(supabaseUrl, supabaseKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });
    }

    const { data, error } = await client.storage
      .from("cratematch-files")
      .download(filePath);

    if (error) throw error;
    return data;
  },

  // List user's database files
  listUserDatabases: async (userId, accessToken = null) => {
    // If access token is provided, create a new client with that token
    let client = supabase;
    if (accessToken) {
      const { createClient } = require("@supabase/supabase-js");
      client = createClient(supabaseUrl, supabaseKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });
    }

    const { data, error } = await client.storage
      .from("cratematch-files")
      .list(`databases/${userId}`);

    if (error) throw error;
    return data;
  },

  // Delete database file
  deleteDatabase: async (userId, fileName) => {
    const filePath = `databases/${userId}/${fileName}`;
    const { data, error } = await supabase.storage
      .from("cratematch-files")
      .remove([filePath]);

    if (error) throw error;
    return data;
  },
};

// Authentication operations
const authOperations = {
  // Sign up new user
  signUp: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${
            process.env.WEBAPP_URL || "http://localhost:3000"
          }/auth/callback`,
        },
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Sign in user
  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Sign out user
  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // Get current user
  getUser: async () => {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) throw error;
      return { user, error: null };
    } catch (error) {
      return { user: null, error };
    }
  },

  // Get current session
  getSession: async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) throw error;
      return { session, error: null };
    } catch (error) {
      return { session: null, error };
    }
  },

  // Reset password
  resetPassword: async (email) => {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${
          process.env.WEBAPP_URL || "http://localhost:3000"
        }/auth/reset-password`,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};

module.exports = {
  supabase,
  machineOperations,
  storageOperations,
  authOperations,
  generateWebMachineId,
};
