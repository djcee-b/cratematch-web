const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
require("dotenv").config();

// Connection pooling configuration
const POOL_SIZE = 20; // Maximum connections in pool
const CONNECTION_TIMEOUT = 30000; // 30 seconds
const REQUEST_TIMEOUT = 60000; // 60 seconds

// Create Supabase client with connection pooling
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false, // We handle session persistence manually
      detectSessionInUrl: false,
    },
    db: {
      schema: "public",
    },
    global: {
      headers: {
        "X-Client-Info": "cratematch-web",
      },
    },
    // Connection pooling settings
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    // Custom fetch with connection pooling
    fetch: (url, options = {}) => {
      return fetch(url, {
        ...options,
        // Connection pooling headers
        headers: {
          ...options.headers,
          'Connection': 'keep-alive',
          'Keep-Alive': 'timeout=30, max=1000',
        },
        // Timeout settings
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });
    },
  }
);

// Connection pool manager
class ConnectionPool {
  constructor() {
    this.connections = new Map();
    this.maxConnections = POOL_SIZE;
    this.activeConnections = 0;
  }

  async getConnection(userId) {
    // Return existing connection if available
    if (this.connections.has(userId)) {
      const conn = this.connections.get(userId);
      if (conn.lastUsed > Date.now() - 300000) { // 5 minutes
        conn.lastUsed = Date.now();
        return conn;
      } else {
        this.connections.delete(userId);
        this.activeConnections--;
      }
    }

    // Create new connection if pool not full
    if (this.activeConnections < this.maxConnections) {
      const connection = {
        id: userId,
        lastUsed: Date.now(),
        supabase: supabase,
      };
      
      this.connections.set(userId, connection);
      this.activeConnections++;
      return connection;
    }

    // If pool is full, return the least recently used connection
    let oldestConnection = null;
    let oldestTime = Date.now();
    
    for (const [id, conn] of this.connections.entries()) {
      if (conn.lastUsed < oldestTime) {
        oldestTime = conn.lastUsed;
        oldestConnection = { id, conn };
      }
    }

    if (oldestConnection) {
      this.connections.delete(oldestConnection.id);
      const connection = {
        id: userId,
        lastUsed: Date.now(),
        supabase: supabase,
      };
      this.connections.set(userId, connection);
      return connection;
    }

    // Fallback to main client
    return { supabase };
  }

  cleanup() {
    const now = Date.now();
    for (const [userId, conn] of this.connections.entries()) {
      if (now - conn.lastUsed > 300000) { // 5 minutes
        this.connections.delete(userId);
        this.activeConnections--;
      }
    }
  }
}

// Global connection pool
const connectionPool = new ConnectionPool();

// Cleanup old connections every 2 minutes
setInterval(() => {
  connectionPool.cleanup();
}, 120000);

// Enhanced auth operations with connection pooling
const authOperations = {
  async getUser(token) {
    try {
      const connection = await connectionPool.getConnection('auth');
      return await connection.supabase.auth.getUser(token);
    } catch (error) {
      console.error('Auth getUser error:', error);
      throw error;
    }
  },

  async refreshSession(refreshToken) {
    try {
      const connection = await connectionPool.getConnection('auth');
      return await connection.supabase.auth.refreshSession({ refresh_token: refreshToken });
    } catch (error) {
      console.error('Auth refresh error:', error);
      throw error;
    }
  },

  async signUp(email, password) {
    try {
      const connection = await connectionPool.getConnection('auth');
      return await connection.supabase.auth.signUp({ email, password });
    } catch (error) {
      console.error('Auth signup error:', error);
      throw error;
    }
  },

  async signIn(email, password) {
    try {
      const connection = await connectionPool.getConnection('auth');
      return await connection.supabase.auth.signInWithPassword({ email, password });
    } catch (error) {
      console.error('Auth signin error:', error);
      throw error;
    }
  },
};

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

  // Get all machines (for admin operations like subscription checks)
  getAllMachines: async () => {
    return supabase.from("machines").select("*");
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
      client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
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
      client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
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
      client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
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

module.exports = { supabase, authOperations, connectionPool, machineOperations, storageOperations, generateWebMachineId };
