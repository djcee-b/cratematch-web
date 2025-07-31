require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { importSpotifyPlaylist } = require("@musiclibrarytools/mlt.js");
const {
  supabase,
  authOperations,
  storageOperations,
  machineOperations,
} = require("./supabase-client");
const { requireAuth, requireActiveSubscription } = require("./auth-middleware");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Enhanced static file serving with logging (moved after routes)
const publicPath = path.join(__dirname, "public");
console.log(`📁 Public directory path: ${publicPath}`);
console.log(`📁 Public directory exists: ${fs.existsSync(publicPath)}`);

let staticServed = false;

if (fs.existsSync(publicPath)) {
  const files = fs.readdirSync(publicPath);
  console.log(`📄 Public directory contents (${files.length} items):`);
  files.forEach((file) => {
    console.log(`  - ${file}`);
  });

  if (files.length > 0) {
    staticServed = true;
    console.log(`✅ Static files will be served from: ${publicPath}`);
  } else {
    console.log(`⚠️  Public directory is empty`);
  }
}

if (!staticServed) {
  console.log(`🔍 Trying alternative paths for static files...`);
  // Try alternative paths for different deployment environments
  const altPaths = [
    path.join(process.cwd(), "public"),
    "/workspace/public",
    "/app/public",
  ];

  for (const altPath of altPaths) {
    if (fs.existsSync(altPath)) {
      const files = fs.readdirSync(altPath);
      if (files.length > 0) {
        console.log(
          `✅ Found public directory at: ${altPath} with ${files.length} files`
        );
        staticServed = true;
        break;
      } else {
        console.log(`⚠️  Found empty public directory at: ${altPath}`);
      }
    }
  }
}

if (!staticServed) {
  console.log(`❌ No valid public directory found for static files`);
}

// Create necessary directories
const uploadsDir = path.join(__dirname, "uploads");
const cratesDir = path.join(__dirname, "crates");
const subcratesDir = path.join(uploadsDir, "Subcrates");

[uploadsDir, cratesDir, subcratesDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Helper function to get user-specific subcrates directory
const getUserSubcratesDir = (userId) => {
  const userSubcratesDir = path.join(subcratesDir, userId);
  if (!fs.existsSync(userSubcratesDir)) {
    fs.mkdirSync(userSubcratesDir, { recursive: true });
  }
  return userSubcratesDir;
};

// Helper function to get user-specific database cache directory
const getUserDatabaseCacheDir = (userId) => {
  const userCacheDir = path.join(uploadsDir, "cache", userId);
  if (!fs.existsSync(userCacheDir)) {
    fs.mkdirSync(userCacheDir, { recursive: true });
  }
  return userCacheDir;
};

// Helper function to check if cached database is still valid (24 hours)
const isDatabaseCacheValid = (filePath) => {
  try {
    const stats = fs.statSync(filePath);
    const now = new Date();
    const fileAge = now.getTime() - stats.mtime.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    console.log(`Cache validation for ${filePath}:`);
    console.log(`  File mtime: ${stats.mtime}`);
    console.log(`  Current time: ${now}`);
    console.log(
      `  File age: ${fileAge}ms (${Math.round(fileAge / 1000 / 60)} minutes)`
    );
    console.log(`  Max age: ${maxAge}ms (24 hours)`);
    console.log(`  Is valid: ${fileAge < maxAge}`);

    return fileAge < maxAge;
  } catch (error) {
    console.error(`Cache validation error for ${filePath}:`, error);
    return false;
  }
};

// Helper function to get cached database path or download if needed
const getOrDownloadDatabase = async (userId, databaseFileName, accessToken) => {
  const userCacheDir = getUserDatabaseCacheDir(userId);
  const cachedPath = path.join(userCacheDir, databaseFileName);

  console.log(`Checking cache for: ${cachedPath}`);
  console.log(`Cache file exists: ${fs.existsSync(cachedPath)}`);

  // Check if we have a valid cached version
  if (fs.existsSync(cachedPath)) {
    const isValid = isDatabaseCacheValid(cachedPath);
    console.log(`Cache file valid: ${isValid}`);

    if (isValid) {
      console.log(`Using cached database: ${cachedPath}`);
      // Copy cached database to original location for MLT.js processing
      const originalPath = path.join(uploadsDir, databaseFileName);
      fs.copyFileSync(cachedPath, originalPath);
      console.log(
        `Copied cached database to original location: ${originalPath}`
      );
      return originalPath;
    } else {
      console.log(`Cache file expired, removing: ${cachedPath}`);
      fs.unlinkSync(cachedPath);
    }
  } else {
    console.log(`Cache file does not exist: ${cachedPath}`);
  }

  // Download fresh database
  console.log(`Downloading database: ${databaseFileName}`);
  try {
    const databaseBuffer = await storageOperations.downloadDatabase(
      userId,
      databaseFileName,
      accessToken
    );

    // Convert ArrayBuffer to Buffer and save to cache
    const buffer = Buffer.from(await databaseBuffer.arrayBuffer());
    fs.writeFileSync(cachedPath, buffer);
    console.log(`Cached database: ${cachedPath}`);

    // Also save to original location for MLT.js processing
    const originalPath = path.join(uploadsDir, databaseFileName);
    fs.copyFileSync(cachedPath, originalPath);
    console.log(`Copied fresh database to original location: ${originalPath}`);

    return originalPath;
  } catch (error) {
    console.error("Database download failed:", error);

    // Check if it's a storage error (file not found)
    if (error.__isStorageError && error.originalError?.status === 400) {
      throw new Error("DATABASE_NOT_FOUND: Database file not found in storage");
    }

    // Re-throw other errors
    throw error;
  }
};

// Cleanup old cached databases (run periodically)
const cleanupExpiredCache = () => {
  try {
    const cacheDir = path.join(uploadsDir, "cache");
    if (!fs.existsSync(cacheDir)) return;

    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    const cleanupUserCache = (userDir) => {
      if (fs.existsSync(userDir)) {
        const files = fs.readdirSync(userDir);
        files.forEach((file) => {
          const filePath = path.join(userDir, file);
          const stats = fs.statSync(filePath);

          // Skip .gitkeep files and only process regular files
          if (file === ".gitkeep" || stats.isDirectory()) {
            return;
          }

          const fileAge = now.getTime() - stats.mtime.getTime();

          if (fileAge > maxAge) {
            fs.unlinkSync(filePath);
            console.log(`Cleaned up expired cache: ${filePath}`);
          }
        });
      }
    };

    const users = fs.readdirSync(cacheDir);
    users.forEach((userId) => {
      // Skip .gitkeep file
      if (userId === ".gitkeep") {
        return;
      }

      const userDir = path.join(cacheDir, userId);

      // Check if it's actually a directory before processing
      if (fs.existsSync(userDir) && fs.statSync(userDir).isDirectory()) {
        cleanupUserCache(userDir);

        // Remove empty user directories (excluding .gitkeep files)
        const files = fs.readdirSync(userDir);
        const nonGitkeepFiles = files.filter((file) => file !== ".gitkeep");

        if (nonGitkeepFiles.length === 0) {
          fs.rmdirSync(userDir);
          console.log(`Removed empty cache directory: ${userDir}`);
        }
      }
    });
  } catch (error) {
    console.error("Cache cleanup error:", error);
  }
};

// Run cache cleanup every hour
const cacheCleanupInterval = setInterval(cleanupExpiredCache, 60 * 60 * 1000);
// Also run cleanup on startup
cleanupExpiredCache();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    cb(null, true); // Accept any file type, let MLT.js validate
  },
});

console.log(`CrateMatch Web Server running on http://localhost:${PORT}`);
console.log(`Uploads directory: ${uploadsDir}`);
console.log(`Crates directory: ${cratesDir}`);

// Authentication routes
app.post("/auth/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "Email and password are required",
      });
    }

    const { data, error } = await authOperations.signUp(email, password);

    if (error) {
      if (
        error.message.includes("User already registered") ||
        error.code === "user_already_exists"
      ) {
        return res.status(400).json({
          error: "User already exists",
          message:
            "An account with this email already exists. Please sign in instead.",
        });
      }
      return res.status(400).json({
        error: "Signup failed",
        message: error.message,
      });
    }

    // Auto-login after signup (even if email not confirmed)
    const { data: signInData, error: signInError } =
      await authOperations.signIn(email, password);

    if (signInError) {
      // If login fails due to email confirmation, still return success
      // User can manually confirm email later if needed
      console.warn("Auto-login failed after signup:", signInError.message);

      res.json({
        success: true,
        message:
          "Account created successfully! Please check your email to verify your account, then sign in.",
        user: data.user,
      });
    } else {
      res.json({
        success: true,
        message: "Account created successfully! Redirecting to onboarding...",
        session: signInData.session,
        user: signInData.user,
      });
    }
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      error: "Signup failed",
      message: "Please try again",
    });
  }
});

app.post("/auth/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "Email and password are required",
      });
    }

    const { data, error } = await authOperations.signIn(email, password);

    if (error) {
      return res.status(400).json({
        error: "Sign in failed",
        message: error.message,
      });
    }

    // Check if data and session exist
    if (!data || !data.session) {
      return res.status(400).json({
        error: "Sign in failed",
        message: "Invalid response from authentication service",
      });
    }

    // Update web_user to true for this user
    try {
      const { data: machine, error: machineError } =
        await machineOperations.getMachineByEmail(email);

      if (machine && !machineError) {
        // Update existing machine record
        await machineOperations.updateMachine(machine.id, { web_user: true });
      } else {
        // Create new machine record for web user
        const webMachineId = require("crypto")
          .createHash("sha256")
          .update(`web-${data.user.id}`)
          .digest("hex");
        await machineOperations.upsertMachine({
          id: webMachineId,
          email: email,
          user_id: data.user.id,
          web_user: true,
          role: "trial",
        });
      }
    } catch (updateError) {
      console.error("Failed to update web_user status:", updateError);
      // Don't fail the signin if this update fails
    }

    res.json({
      success: true,
      message: "Signed in successfully!",
      session: data.session,
      user: data.user,
    });
  } catch (error) {
    console.error("Sign in error:", error);
    res.status(500).json({
      error: "Sign in failed",
      message: "Please try again",
    });
  }
});

app.post("/auth/signout", requireAuth, async (req, res) => {
  try {
    const { error } = await authOperations.signOut();
    if (error) {
      return res.status(500).json({
        error: "Sign out failed",
        message: "Please try again",
      });
    }
    res.json({
      success: true,
      message: "Signed out successfully!",
    });
  } catch (error) {
    console.error("Sign out error:", error);
    res.status(500).json({
      error: "Sign out failed",
      message: "Please try again",
    });
  }
});

app.post("/auth/reset-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Missing email",
        message: "Email is required",
      });
    }

    const { data, error } = await authOperations.resetPassword(email);

    if (error) {
      return res.status(500).json({
        error: "Password reset failed",
        message: error.message,
      });
    }

    res.json({
      success: true,
      message: "Password reset link sent to your email!",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({
      error: "Password reset failed",
      message: "Please try again",
    });
  }
});

// Get current user and subscription status (requires active subscription)
app.get(
  "/auth/me",
  requireAuth,
  requireActiveSubscription,
  async (req, res) => {
    try {
      const { data: machine, error } =
        await machineOperations.getMachineByEmail(req.user.email);

      if (error) {
        return res.status(500).json({
          error: "Failed to fetch user data",
          message: "Please try again",
        });
      }

      res.json({
        user: req.user,
        machine: machine,
        subscriptionStatus: machine?.role || "trial",
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({
        error: "Failed to fetch user data",
        message: "Please try again",
      });
    }
  }
);

// Get current user for pricing page (doesn't require active subscription)
app.get("/api/auth/verify", requireAuth, async (req, res) => {
  try {
    const { data: machine, error } = await machineOperations.getMachineByEmail(
      req.user.email
    );

    if (error) {
      return res.status(500).json({
        error: "Failed to fetch user data",
        message: "Please try again",
      });
    }

    res.json({
      user: req.user,
      machine: machine,
      subscriptionStatus: machine?.role || "trial",
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      error: "Failed to fetch user data",
      message: "Please try again",
    });
  }
});

// Create Stripe Customer Portal session for subscription management
app.post("/api/stripe/create-portal-session", requireAuth, async (req, res) => {
  try {
    const { data: machine, error } = await machineOperations.getMachineByEmail(
      req.user.email
    );

    if (error || !machine) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get or create Stripe customer
    let customer;
    if (machine.stripe_customer_id) {
      customer = await stripe.customers.retrieve(machine.stripe_customer_id);
    } else {
      // Create new customer
      customer = await stripe.customers.create({
        email: req.user.email,
        metadata: {
          user_id: req.user.id,
          machine_id: machine.id,
        },
      });

      // Update machine with Stripe customer ID
      await machineOperations.updateMachine(machine.id, {
        stripe_customer_id: customer.id,
      });
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${
        process.env.WEBAPP_URL || "http://localhost:3000"
      }/settings.html`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating portal session:", error);
    res.status(500).json({ error: "Failed to create portal session" });
  }
});

// Upload database to Supabase storage
app.post(
  "/upload-database",
  requireAuth,
  requireActiveSubscription,
  upload.single("database"),
  async (req, res) => {
    try {
      console.log("Upload request received");
      console.log("User:", req.user);
      console.log("User ID:", req.user.id);
      console.log("User email:", req.user.email);
      console.log("File:", req.file ? "Present" : "Missing");

      if (!req.file) {
        return res.status(400).json({
          error: "No file uploaded",
          message: "Please select a database file",
        });
      }

      // Use a consistent filename for the user's database
      const fileName = `database-v2`;

      console.log("About to upload to Supabase storage");
      console.log("File path:", `databases/${req.user.id}/${fileName}`);

      // Get the user's access token from the request headers
      const authHeader = req.headers.authorization;
      const accessToken = authHeader ? authHeader.substring(7) : null;

      console.log("Access token present:", !!accessToken);

      // First, delete any existing database files for this user
      try {
        const existingDatabases = await storageOperations.listUserDatabases(
          req.user.id,
          accessToken
        );

        if (existingDatabases && existingDatabases.length > 0) {
          console.log("Deleting existing database files...");
          for (const file of existingDatabases) {
            await storageOperations.deleteDatabase(req.user.id, file.name);
            console.log(`Deleted: ${file.name}`);
          }
        }
      } catch (error) {
        console.log(
          "No existing files to delete or error deleting:",
          error.message
        );
      }

      // Upload to Supabase storage (will replace due to upsert: true)
      await storageOperations.uploadDatabase(
        req.user.id,
        req.file.buffer,
        fileName,
        accessToken
      );

      console.log("Upload successful!");

      // Also save locally for MLT.js processing (use user-specific filename)
      const localFileName = `database-${req.user.id}`;
      const localPath = path.join(uploadsDir, localFileName);
      fs.writeFileSync(localPath, req.file.buffer);

      res.json({
        success: true,
        message: "Database uploaded successfully!",
        fileName: fileName,
        localPath: localPath,
      });
    } catch (error) {
      console.error("Database upload error:", error);
      console.error("Error details:", {
        message: error.message,
        statusCode: error.statusCode,
        error: error.error,
      });
      res.status(500).json({
        error: "Upload failed",
        message: "Please try again",
      });
    }
  }
);

// Get user's uploaded databases
app.get(
  "/databases",
  requireAuth,
  requireActiveSubscription,
  async (req, res) => {
    try {
      // Get the user's access token from the request headers
      const authHeader = req.headers.authorization;
      const accessToken = authHeader ? authHeader.substring(7) : null;

      const databases = await storageOperations.listUserDatabases(
        req.user.id,
        accessToken
      );

      res.json({
        success: true,
        databases: databases || [],
      });
    } catch (error) {
      console.error("List databases error:", error);
      res.status(500).json({
        error: "Failed to fetch databases",
        message: "Please try again",
      });
    }
  }
);

// Process playlist with authentication
app.post(
  "/process-playlist",
  requireAuth,
  requireActiveSubscription,
  async (req, res) => {
    let databaseFileName;
    try {
      const {
        playlistUrl,
        threshold = 90,
        databaseFileName: dbFileName,
      } = req.body;
      databaseFileName = dbFileName; // Make it available in catch block

      if (!playlistUrl) {
        return res.status(400).json({
          error: "Missing playlist URL",
          message: "Please provide a Spotify playlist URL",
        });
      }

      if (!databaseFileName) {
        return res.status(400).json({
          error: "No database selected",
          message: "Please upload a database first",
        });
      }

      console.log(`Processing playlist: ${playlistUrl}`);

      // Get the user's access token from the request headers
      const authHeader = req.headers.authorization;
      const accessToken = authHeader ? authHeader.substring(7) : null;

      // Get or download cached database
      const localDatabasePath = await getOrDownloadDatabase(
        req.user.id,
        databaseFileName,
        accessToken
      );

      console.log(`Using database: ${localDatabasePath}`);
      console.log(`Threshold: ${threshold}`);

      // Process the playlist
      const results = await importSpotifyPlaylist(
        playlistUrl,
        (progress) => {
          console.log(`Import progress: ${progress.message || progress}%`);
        },
        threshold,
        localDatabasePath,
        req.machine.role === "free" // isFreeUser - set based on user's subscription status
      );

      console.log("Import process completed!");

      // Find the generated crate file in the global subcrates directory
      let crateFile = null;
      let hasCrateFile = false;
      let downloadUrl = null;

      console.log(
        "Looking for crate files in global subcrates directory:",
        subcratesDir
      );
      console.log(
        "Global subcrates directory exists:",
        fs.existsSync(subcratesDir)
      );

      if (fs.existsSync(subcratesDir)) {
        const files = fs.readdirSync(subcratesDir);
        console.log("Files in global subcrates directory:", files);

        const playlistName = results.playlistName || "playlist";
        console.log("Looking for playlist name:", playlistName);

        // Find crate file that starts with playlist name
        // Look for the main crate file first (without numbers)
        let crateFileFound = files.find(
          (file) => file.endsWith(".crate") && file === `${playlistName}.crate`
        );

        // If not found, look for any file that contains the playlist name
        if (!crateFileFound) {
          crateFileFound = files.find(
            (file) =>
              file.endsWith(".crate") &&
              file.toLowerCase().includes(playlistName.toLowerCase())
          );
        }

        console.log("Found crate file in global directory:", crateFileFound);

        if (crateFileFound) {
          // Get user-specific subcrates directory
          const userSubcratesDir = getUserSubcratesDir(req.user.id);

          // Clear any existing crate files in user directory (only keep one)
          if (fs.existsSync(userSubcratesDir)) {
            const userFiles = fs.readdirSync(userSubcratesDir);
            userFiles.forEach((file) => {
              if (file.endsWith(".crate")) {
                fs.unlinkSync(path.join(userSubcratesDir, file));
                console.log(`Removed old crate file: ${file}`);
              }
            });
          }

          // Move the crate file from global to user-specific directory
          const globalSourcePath = path.join(subcratesDir, crateFileFound);
          const userDestPath = path.join(userSubcratesDir, crateFileFound);

          fs.copyFileSync(globalSourcePath, userDestPath);
          console.log(
            `Moved crate file from ${globalSourcePath} to ${userDestPath}`
          );

          // Remove the file from global directory
          fs.unlinkSync(globalSourcePath);
          console.log(
            `Removed crate file from global directory: ${crateFileFound}`
          );

          // Now copy to the main crates directory for download
          const sanitizedPlaylistName = playlistName
            .replace(/[^a-zA-Z0-9\s]/g, "")
            .trim();
          const crateFileName = `${sanitizedPlaylistName}.crate`;
          const finalDestPath = path.join(cratesDir, crateFileName);

          fs.copyFileSync(userDestPath, finalDestPath);
          crateFile = crateFileName;
          hasCrateFile = true;
          downloadUrl = `/download-crate/${encodeURIComponent(crateFileName)}`;

          console.log(`Crate file ready for download: ${finalDestPath}`);
        }
      }

      // Clean up temporary database file from original location
      const tempDatabasePath = path.join(uploadsDir, databaseFileName);
      try {
        if (fs.existsSync(tempDatabasePath)) {
          fs.unlinkSync(tempDatabasePath);
          console.log(`Cleaned up temporary database: ${tempDatabasePath}`);
        }
      } catch (cleanupError) {
        console.error("Failed to cleanup temporary database:", cleanupError);
      }

      console.log("Sending response to frontend:", {
        success: true,
        results: results,
        crateFile: crateFile,
        downloadUrl: downloadUrl,
        hasCrateFile: hasCrateFile,
      });

      res.json({
        success: true,
        results: results,
        crateFile: crateFile,
        downloadUrl: downloadUrl,
        hasCrateFile: hasCrateFile,
      });
    } catch (error) {
      console.error("Playlist processing error:", error);

      // Clean up temporary database file even on error
      if (databaseFileName) {
        const tempDatabasePath = path.join(uploadsDir, databaseFileName);
        try {
          if (fs.existsSync(tempDatabasePath)) {
            fs.unlinkSync(tempDatabasePath);
            console.log(
              `Cleaned up temporary database after error: ${tempDatabasePath}`
            );
          }
        } catch (cleanupError) {
          console.error(
            "Failed to cleanup temporary database after error:",
            cleanupError
          );
        }
      }

      // Check if this is a free user limitation error
      let errorMessage = error.message || "Please try again";
      if (
        error.message &&
        error.message.includes(
          "Free users are limited to importing playlists with 50 tracks or fewer"
        )
      ) {
        errorMessage =
          "This playlist has more than 50 tracks. Free users are limited to 50 tracks per playlist.";
      }

      res.status(500).json({
        error: "Processing failed",
        message: errorMessage,
        showUpgrade: true,
      });
    }
  }
);

// Custom auth middleware for progress endpoint (handles token in query params)
const requireAuthForProgress = async (req, res, next) => {
  try {
    const token = req.query.token;

    if (!token) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Please sign in to continue",
      });
    }

    // Set the session token for Supabase
    const { supabase } = require("./supabase-client");
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: "Invalid token",
        message: "Please sign in again",
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      error: "Authentication error",
      message: "Please try again",
    });
  }
};

// Custom subscription middleware for progress endpoint
const requireActiveSubscriptionForProgress = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Please sign in to continue",
      });
    }

    // Get user's machine record to check subscription status
    const { machineOperations } = require("./supabase-client");
    const { data: machine, error } = await machineOperations.getMachineByEmail(
      req.user.email
    );

    if (error) {
      console.error("Error fetching machine data:", error);
      return res.status(500).json({
        error: "Subscription check failed",
        message: "Please try again",
      });
    }

    if (!machine) {
      return res.status(403).json({
        error: "No account found",
        message: "Please complete onboarding first",
      });
    }

    // Check if user is in trial period
    if (machine.role === "trial") {
      const trialEnd = new Date(machine.trial_end);
      const now = new Date();

      if (now > trialEnd) {
        return res.status(403).json({
          error: "Trial expired",
          message: "Your trial has expired. Please upgrade to continue.",
          trialExpired: true,
        });
      }
    }

    // Allow free and premium users
    if (machine.role === "free" || machine.role === "premium") {
      req.machine = machine;
      return next();
    }

    // Allow trial users (already checked above)
    if (machine.role === "trial") {
      req.machine = machine;
      return next();
    }

    // Unknown role - treat as free user
    req.machine = machine;
    next();
  } catch (error) {
    console.error("Subscription middleware error:", error);
    return res.status(500).json({
      error: "Subscription check failed",
      message: "Please try again",
    });
  }
};

// Store active processing sessions
const activeSessions = new Map();

// Process playlist with progress updates (Server-Sent Events)
app.get(
  "/process-playlist-progress",
  requireAuthForProgress,
  requireActiveSubscriptionForProgress,
  async (req, res) => {
    // Extract variables outside try block so they're available in catch
    const { playlistUrl, threshold, databaseFileName } = req.query;

    // Create session tracking
    const sessionId = req.user.id + "_" + Date.now();
    const session = {
      res,
      userId: req.user.id,
      playlistUrl: playlistUrl,
      isActive: true,
      abortController: new AbortController(),
    };

    // Store the session
    activeSessions.set(sessionId, session);

    // Handle client disconnect
    req.on("close", () => {
      console.log(
        `Client disconnected, stopping processing for session: ${sessionId}`
      );
      const session = activeSessions.get(sessionId);
      if (session) {
        session.isActive = false;
        session.abortController.abort();
        activeSessions.delete(sessionId);
      }
    });

    try {
      if (!playlistUrl || !threshold || !databaseFileName) {
        return res.status(400).json({
          error: "Missing required fields",
          message:
            "Please provide playlist URL, threshold, and database file name",
        });
      }

      // Set headers for Server-Sent Events
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Transfer-Encoding": "chunked",
        "Content-Encoding": "none",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
      });

      console.log(`Processing playlist with progress: ${playlistUrl}`);

      // Get the user's access token from query parameters (EventSource doesn't support custom headers)
      const accessToken = req.query.token;

      if (!accessToken) {
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            error: "Authentication required",
            message: "Please sign in to continue",
          })}\n\n`
        );
        res.end();
        return;
      }

      // Send initial progress
      res.write(
        `data: ${JSON.stringify({
          type: "progress",
          progress: 5,
          message: "Initializing playlist processing...",
          stage: "Initializing",
        })}\n\n`
      );

      // Get or download cached database
      let localDatabasePath;
      try {
        localDatabasePath = await getOrDownloadDatabase(
          req.user.id,
          databaseFileName,
          accessToken
        );
      } catch (dbError) {
        console.error("Database download error:", dbError);

        // Check if it's a database not found error
        if (dbError.message && dbError.message.includes("DATABASE_NOT_FOUND")) {
          return res.status(400).json({
            error: "Database not found",
            message:
              "Please upload a database file first. Go to Settings to upload your Serato database.",
          });
        }

        // Check if it's a storage error (file not found)
        if (dbError.message && dbError.message.includes("400")) {
          return res.status(400).json({
            error: "Database not found",
            message:
              "Please upload a database file first. Go to Settings to upload your Serato database.",
          });
        }

        return res.status(500).json({
          error: "Database error",
          message:
            "Failed to access database. Please try again or contact support.",
        });
      }

      res.write(
        `data: ${JSON.stringify({
          type: "progress",
          progress: 15,
          message: "Database loaded, starting playlist processing...",
          stage: "Loading database",
        })}\n\n`
      );

      console.log(`Using database: ${localDatabasePath}`);
      console.log(`Threshold: ${threshold}`);

      // Set up periodic progress updates in case MLT.js callback doesn't fire
      let lastProgressUpdate = Date.now();
      const progressInterval = setInterval(() => {
        const currentSession = activeSessions.get(sessionId);
        if (!currentSession || !currentSession.isActive) {
          clearInterval(progressInterval);
          return;
        }

        const timeSinceLastUpdate = Date.now() - lastProgressUpdate;
        if (timeSinceLastUpdate > 5000) {
          // 5 seconds without update
          console.log("No progress update received, sending heartbeat...");
          try {
            res.write(
              `data: ${JSON.stringify({
                type: "progress",
                progress: 50,
                message: "Processing playlist... (heartbeat)",
                stage: "Processing tracks",
              })}\n\n`
            );
          } catch (writeError) {
            console.error("Failed to write heartbeat progress:", writeError);
            clearInterval(progressInterval);
          }
        }
      }, 3000); // Check every 3 seconds

      // Track progress stages for better granular updates
      let progressStage = 0;
      const totalStages = 8; // Approximate number of major processing stages

      // Process the playlist with progress updates
      const results = await importSpotifyPlaylist(
        playlistUrl,
        (progress) => {
          lastProgressUpdate = Date.now(); // Update timestamp when we get progress
          // Check if session is still active
          const currentSession = activeSessions.get(sessionId);
          if (!currentSession || !currentSession.isActive) {
            console.log(
              `Session ${sessionId} is no longer active, stopping processing`
            );
            throw new Error("Client disconnected");
          }

          console.log("Progress callback received:", progress);
          console.log("Progress type:", typeof progress);
          console.log("Progress constructor:", progress?.constructor?.name);
          console.log(
            "Progress keys:",
            progress && typeof progress === "object"
              ? Object.keys(progress)
              : "N/A"
          );
          console.log(
            "Full progress object:",
            JSON.stringify(progress, null, 2)
          );

          // Handle different progress formats
          let progressPercent;
          let message;

          if (typeof progress === "number") {
            // If progress is a number, assume it's already a percentage (0-100)
            progressPercent = Math.min(90, Math.max(10, progress));
            message = `Processing playlist... ${Math.round(progressPercent)}%`;
          } else if (progress && typeof progress === "object") {
            // If progress is an object with percentage property
            if (
              typeof progress.current === "number" &&
              typeof progress.total === "number"
            ) {
              progressPercent = (progress.current / progress.total) * 100;
            } else if (progress.percentage !== undefined) {
              progressPercent = Math.min(90, Math.max(10, progress.percentage));
            } else if (progress.progress !== undefined) {
              progressPercent = Math.min(90, Math.max(10, progress.progress));
            } else if (progress.value !== undefined) {
              progressPercent = Math.min(90, Math.max(10, progress.value));
            } else if (progress.percent !== undefined) {
              progressPercent = Math.min(90, Math.max(10, progress.percent));
            } else {
              progressPercent = 50; // Default fallback
            }
            message =
              progress.message ||
              progress.status ||
              `Processing playlist... ${Math.round(progressPercent)}%`;
          } else if (typeof progress === "string") {
            // If progress is a string, try to extract a number or use as message
            const numMatch = progress.match(/(\d+(?:\.\d+)?)/);
            if (numMatch) {
              progressPercent = Math.min(
                90,
                Math.max(10, parseFloat(numMatch[1]))
              );
            } else {
              progressPercent = 50;
            }
            message = progress;
          } else {
            // Fallback for other formats
            progressPercent = 50;
            message =
              progress?.message ||
              progress?.status ||
              progress ||
              `Processing playlist... ${Math.round(progressPercent)}%`;
          }

          // Ensure we always have a valid progress percentage
          if (
            progressPercent === null ||
            progressPercent === undefined ||
            isNaN(progressPercent)
          ) {
            // Use stage-based progress instead of defaulting to 50%
            progressStage++;
            const stageProgress = Math.min(
              85,
              15 + (progressStage / totalStages) * 70
            );
            progressPercent = Math.round(stageProgress);
          }

          console.log(`Sending progress: ${progressPercent}% - ${message}`);

          // Check again before sending
          const sessionCheck = activeSessions.get(sessionId);
          if (!sessionCheck || !sessionCheck.isActive) {
            throw new Error("Client disconnected");
          }

          try {
            // Prepare progress data with enhanced information
            const progressData = {
              type: "progress",
              progress: Math.round(progressPercent),
              message: message,
            };

            // Try to extract track information from message if it's a string
            if (typeof progress === "string") {
              const trackMatch = progress.match(/(\d+)\s*\/\s*(\d+)/);
              if (trackMatch) {
                progressData.current = parseInt(trackMatch[1]);
                progressData.total = parseInt(trackMatch[2]);
                progressData.trackCount = `Track ${trackMatch[1]} / ${trackMatch[2]}`;
              }
            }

            // Add current/total track information if available
            if (progress && typeof progress === "object") {
              if (
                typeof progress.current === "number" &&
                typeof progress.total === "number"
              ) {
                progressData.current = progress.current;
                progressData.total = progress.total;
                progressData.trackCount = `Track ${progress.current} / ${progress.total}`;
              }

              // Try to extract track information from message if not already available
              if (!progressData.trackCount && progress.message) {
                const trackMatch = progress.message.match(/(\d+)\s*\/\s*(\d+)/);
                if (trackMatch) {
                  progressData.current = parseInt(trackMatch[1]);
                  progressData.total = parseInt(trackMatch[2]);
                  progressData.trackCount = `Track ${trackMatch[1]} / ${trackMatch[2]}`;
                }
              }

              // Add stage information
              if (progress.stage) {
                progressData.stage = progress.stage;
              } else if (
                progress.message &&
                progress.message.toLowerCase().includes("spotify")
              ) {
                progressData.stage = "Fetching Spotify tracks";
              } else if (
                progress.message &&
                progress.message.toLowerCase().includes("match")
              ) {
                progressData.stage = "Matching tracks";
              } else if (
                progress.message &&
                progress.message.toLowerCase().includes("database")
              ) {
                progressData.stage = "Loading database";
              } else if (
                progress.message &&
                progress.message.toLowerCase().includes("crate")
              ) {
                progressData.stage = "Generating crate file";
              } else if (
                progress.message &&
                progress.message.toLowerCase().includes("processing")
              ) {
                progressData.stage = "Processing tracks";
              } else if (
                progress.message &&
                progress.message.toLowerCase().includes("import")
              ) {
                progressData.stage = "Importing playlist";
              } else if (
                progress.message &&
                progress.message.toLowerCase().includes("fetching")
              ) {
                progressData.stage = "Fetching tracks";
              } else if (
                progress.message &&
                progress.message.toLowerCase().includes("analyzing")
              ) {
                progressData.stage = "Analyzing tracks";
              }
            }

            res.write(`data: ${JSON.stringify(progressData)}\n\n`);
          } catch (writeError) {
            console.error("Failed to write progress update:", writeError);
            throw new Error("Client disconnected");
          }
        },
        threshold,
        localDatabasePath,
        req.machine.role === "free" // isFreeUser - set based on user's subscription status
      );

      res.write(
        `data: ${JSON.stringify({
          type: "progress",
          progress: 90,
          message: "Processing complete, generating crate file...",
          stage: "Generating crate file",
        })}\n\n`
      );

      console.log("Import process completed!");

      // Clean up progress interval
      clearInterval(progressInterval);

      // Find the generated crate file in the global subcrates directory
      let crateFile = null;
      let hasCrateFile = false;
      let downloadUrl = null;

      console.log(
        "Looking for crate files in global subcrates directory:",
        subcratesDir
      );
      console.log(
        "Global subcrates directory exists:",
        fs.existsSync(subcratesDir)
      );

      if (fs.existsSync(subcratesDir)) {
        const files = fs.readdirSync(subcratesDir);
        console.log("Files in global subcrates directory:", files);

        const playlistName = results.playlistName || "playlist";
        console.log("Looking for playlist name:", playlistName);

        // Find crate file that starts with playlist name
        // Look for the main crate file first (without numbers)
        let crateFileFound = files.find(
          (file) => file.endsWith(".crate") && file === `${playlistName}.crate`
        );

        // If not found, look for any file that contains the playlist name
        if (!crateFileFound) {
          crateFileFound = files.find(
            (file) =>
              file.endsWith(".crate") &&
              file.toLowerCase().includes(playlistName.toLowerCase())
          );
        }

        console.log("Found crate file in global directory:", crateFileFound);

        if (crateFileFound) {
          // Get user-specific subcrates directory
          const userSubcratesDir = getUserSubcratesDir(req.user.id);

          // Clear any existing crate files in user directory (only keep one)
          if (fs.existsSync(userSubcratesDir)) {
            const userFiles = fs.readdirSync(userSubcratesDir);
            userFiles.forEach((file) => {
              if (file.endsWith(".crate")) {
                fs.unlinkSync(path.join(userSubcratesDir, file));
                console.log(`Removed old crate file: ${file}`);
              }
            });
          }

          // Move the crate file from global to user-specific directory
          const globalSourcePath = path.join(subcratesDir, crateFileFound);
          const userDestPath = path.join(userSubcratesDir, crateFileFound);

          fs.copyFileSync(globalSourcePath, userDestPath);
          console.log(
            `Moved crate file from ${globalSourcePath} to ${userDestPath}`
          );

          // Remove the file from global directory
          fs.unlinkSync(globalSourcePath);
          console.log(
            `Removed crate file from global directory: ${crateFileFound}`
          );

          // Now copy to the main crates directory for download
          const sanitizedPlaylistName = playlistName
            .replace(/[^a-zA-Z0-9\s]/g, "")
            .trim();
          const crateFileName = `${sanitizedPlaylistName}.crate`;
          const finalDestPath = path.join(cratesDir, crateFileName);

          fs.copyFileSync(userDestPath, finalDestPath);
          crateFile = crateFileName;
          hasCrateFile = true;
          downloadUrl = `/download-crate/${encodeURIComponent(crateFileName)}`;

          console.log(`Crate file ready for download: ${finalDestPath}`);
        }
      }

      // Clean up temporary database file from original location
      const tempDatabasePath = path.join(uploadsDir, databaseFileName);
      try {
        if (fs.existsSync(tempDatabasePath)) {
          fs.unlinkSync(tempDatabasePath);
          console.log(`Cleaned up temporary database: ${tempDatabasePath}`);
        }
      } catch (cleanupError) {
        console.error("Failed to cleanup temporary database:", cleanupError);
      }

      res.write(
        `data: ${JSON.stringify({
          type: "progress",
          progress: 100,
          message: "Processing complete!",
          stage: "Complete",
        })}\n\n`
      );

      console.log("Sending completion response to frontend:", {
        success: true,
        results: results,
        crateFile: crateFile,
        downloadUrl: downloadUrl,
        hasCrateFile: hasCrateFile,
      });

      // Send completion data
      res.write(
        `data: ${JSON.stringify({
          type: "complete",
          success: true,
          results: results,
          crateFile: crateFile,
          downloadUrl: downloadUrl,
          hasCrateFile: hasCrateFile,
        })}\n\n`
      );

      // Clean up session
      activeSessions.delete(sessionId);
      res.end();
    } catch (error) {
      console.error("Playlist processing error:", error);

      // Clean up session
      activeSessions.delete(sessionId);

      // Check if this was a client disconnect
      if (error.message === "Client disconnected") {
        console.log(
          `Processing stopped due to client disconnect for session: ${sessionId}`
        );
        return; // Don't send error response since client is gone
      }

      // Clean up temporary database file even on error
      if (databaseFileName) {
        const tempDatabasePath = path.join(uploadsDir, databaseFileName);
        try {
          if (fs.existsSync(tempDatabasePath)) {
            fs.unlinkSync(tempDatabasePath);
            console.log(
              `Cleaned up temporary database after error: ${tempDatabasePath}`
            );
          }
        } catch (cleanupError) {
          console.error(
            "Failed to cleanup temporary database after error:",
            cleanupError
          );
        }
      }

      // Check if this is a free user limitation error
      let errorMessage = error.message || "Please try again";
      if (
        error.message &&
        error.message.includes(
          "Free users are limited to importing playlists with 50 tracks or fewer"
        )
      ) {
        errorMessage =
          "This playlist has more than 50 tracks. Free users are limited to 50 tracks per playlist.";
      }

      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error: "Processing failed",
          message: errorMessage,
          showUpgrade: true,
        })}\n\n`
      );
      res.end();
    }
  }
);

// Download crate file
app.get(
  "/download-crate/:filename",
  requireAuth,
  requireActiveSubscription,
  (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.join(cratesDir, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          error: "File not found",
          message: "The requested crate file was not found",
        });
      }

      res.download(filePath, filename);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({
        error: "Download failed",
        message: "Please try again",
      });
    }
  }
);

// Serve the main application
app.get("/", (req, res) => {
  const indexPath = path.join(__dirname, "public", "index.html");
  console.log(`🔍 Serving index.html from: ${indexPath}`);
  console.log(`📄 File exists: ${fs.existsSync(indexPath)}`);

  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Try alternative paths
    const altPaths = [
      path.join(process.cwd(), "public", "index.html"),
      "/workspace/public/index.html",
      "/app/public/index.html",
    ];

    for (const altPath of altPaths) {
      if (fs.existsSync(altPath)) {
        console.log(`✅ Found index.html at: ${altPath}`);
        return res.sendFile(altPath);
      }
    }

    console.log(`❌ index.html not found in any location`);
    res.status(404).send("App page not found");
  }
});

// Serve other pages
app.get("/auth", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "auth.html"));
});

app.get("/app", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app.html"));
});

app.get("/onboarding", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "onboarding.html"));
});

app.get("/pricing.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pricing.html"));
});

app.get("/settings.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "settings.html"));
});

// Add route for /settings (without .html extension)
app.get("/settings", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "settings.html"));
});

// Scan History API endpoints
app.get("/api/scan-history", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("📖 Fetching scan history for user:", userId);

    // Get user's scan history (limit to 10 most recent)
    const { data: scanHistory, error } = await supabase
      .from("scan_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("🔍 GET error details:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      // Check if it's a table doesn't exist error
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.log("✅ Scan history table does not exist yet");
        return res.json({ scanHistory: [] });
      }
      console.error("❌ Error fetching scan history:", error);
      return res.status(500).json({ error: "Failed to fetch scan history" });
    }

    console.log(
      "✅ Scan history fetched successfully:",
      scanHistory?.length || 0,
      "items"
    );
    res.json({ scanHistory: scanHistory || [] });
  } catch (error) {
    console.error("❌ Error in scan history GET endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/scan-history", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      spotify_playlist_url,
      spotify_playlist_name,
      found_tracks_count,
      missing_tracks_count,
      total_tracks,
      results,
    } = req.body;

    console.log("📝 Scan history POST request:", {
      userId,
      spotify_playlist_url,
      spotify_playlist_name,
      found_tracks_count,
      missing_tracks_count,
      total_tracks,
      hasResults: !!results,
      resultsSize: results ? JSON.stringify(results).length : 0,
    });

    // Validate required fields
    if (!spotify_playlist_url) {
      return res
        .status(400)
        .json({ error: "Spotify playlist URL is required" });
    }

    // Check if user already has 10 scans, if so, delete the oldest one
    const { data: existingScans, error: countError } = await supabase
      .from("scan_history")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (countError) {
      console.error("🔍 Count error details:", {
        code: countError.code,
        message: countError.message,
        details: countError.details,
        hint: countError.hint,
      });

      // Check if it's a table doesn't exist error
      if (
        countError.code === "42P01" ||
        countError.message.includes("does not exist")
      ) {
        console.log("✅ Scan history table does not exist yet, skipping save");
        return res.json({ success: true, scan: null });
      }
      console.error("❌ Error checking existing scans:", countError);
      return res.status(500).json({ error: "Failed to check existing scans" });
    }

    // If user has 10 or more scans, delete the oldest one
    if (existingScans && existingScans.length >= 10) {
      const oldestScan = existingScans[0];
      const { error: deleteError } = await supabase
        .from("scan_history")
        .delete()
        .eq("id", oldestScan.id);

      if (deleteError) {
        console.error("Error deleting oldest scan:", deleteError);
        // Continue anyway, as this is not critical
      }
    }

    // Insert new scan history
    const { data: newScan, error: insertError } = await supabase
      .from("scan_history")
      .insert({
        user_id: userId,
        spotify_playlist_url,
        spotify_playlist_name: spotify_playlist_name || "Playlist",
        found_tracks_count: found_tracks_count || 0,
        missing_tracks_count: missing_tracks_count || 0,
        total_tracks: total_tracks || 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error("🔍 Insert error details:", {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
      });
      return res.status(500).json({ error: "Failed to save scan history" });
    }

    console.log("✅ Scan history saved successfully:", newScan);

    // If detailed results are provided, save them as JSON to scan_history
    if (results && newScan && newScan.id) {
      try {
        console.log("📝 Saving detailed results to scan_history table");
        console.log("📊 Results structure:", {
          keys: Object.keys(results),
          foundTracksCount: results.foundTracksList?.length || 0,
          missingTracksCount: results.missingTracksList?.length || 0,
          totalTracks: results.totalTracks || 0,
        });

        console.log(
          "🔍 Sample found track data:",
          results.foundTracksList?.[0]
        );
        console.log(
          "🔍 Sample missing track data:",
          results.missingTracksList?.[0]
        );

        // Update the scan_history record with the JSON results
        const { error: updateError } = await supabase
          .from("scan_history")
          .update({ scan_results: results })
          .eq("id", newScan.id);

        if (updateError) {
          console.error("Error saving scan results JSON:", updateError);
          console.error("Update error details:", {
            code: updateError.code,
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint,
          });
          // Don't fail the request, just log the error
        } else {
          console.log(
            "✅ Scan results saved as JSON to scan_history table successfully"
          );
        }
      } catch (error) {
        console.error("Error processing scan results JSON:", error);
        console.error("Exception details:", error.message, error.stack);
        // Don't fail the request, just log the error
      }
    } else {
      console.log("⚠️ No results or newScan to save:", {
        hasResults: !!results,
        hasNewScan: !!newScan,
        newScanId: newScan?.id,
      });
    }

    res.json({ success: true, scan: newScan });
  } catch (error) {
    console.error("❌ Error in scan history POST endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get detailed scan results by scan ID
app.get("/api/scan-history/:scanId", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const scanId = req.params.scanId;

    console.log(
      "📖 Fetching detailed scan results for user:",
      userId,
      "scan:",
      scanId
    );

    // First verify the scan belongs to the user
    const { data: scanHistory, error: scanError } = await supabase
      .from("scan_history")
      .select("*")
      .eq("id", scanId)
      .eq("user_id", userId)
      .single();

    if (scanError || !scanHistory) {
      console.error("❌ Scan not found or access denied:", scanError);
      return res.status(404).json({ error: "Scan not found" });
    }

    // Get the detailed results from JSON
    const scanResults = scanHistory.scan_results;

    if (!scanResults) {
      console.log("✅ No detailed results found for this scan");
      return res.json({
        scan: scanHistory,
        tracks: [],
        foundTracks: [],
        missingTracks: [],
      });
    }

    // Extract found and missing tracks from JSON
    console.log("🔍 Extracting tracks from scan_results:", {
      scanResultsKeys: Object.keys(scanResults || {}),
      hasFoundTracksDetailed: !!(
        scanResults && scanResults.foundTracksDetailed
      ),
      hasMissingTracksDetailed: !!(
        scanResults && scanResults.missingTracksDetailed
      ),
      hasFoundTracksList: !!(scanResults && scanResults.foundTracksList),
      hasMissingTracksList: !!(scanResults && scanResults.missingTracksList),
      foundTracksDetailedLength: scanResults?.foundTracksDetailed?.length || 0,
      missingTracksDetailedLength:
        scanResults?.missingTracksDetailed?.length || 0,
      foundTracksListLength: scanResults?.foundTracksList?.length || 0,
      missingTracksListLength: scanResults?.missingTracksList?.length || 0,
    });

    // Extract detailed track data (with Serato info) from scan_results JSONB
    const foundTracks =
      scanResults.foundTracksDetailed &&
      Array.isArray(scanResults.foundTracksDetailed)
        ? scanResults.foundTracksDetailed
        : scanResults.foundTracksList &&
          Array.isArray(scanResults.foundTracksList)
        ? scanResults.foundTracksList
        : scanResults.foundTracks && Array.isArray(scanResults.foundTracks)
        ? scanResults.foundTracks
        : [];
    const missingTracks =
      scanResults.missingTracksDetailed &&
      Array.isArray(scanResults.missingTracksDetailed)
        ? scanResults.missingTracksDetailed
        : scanResults.missingTracksList &&
          Array.isArray(scanResults.missingTracksList)
        ? scanResults.missingTracksList
        : scanResults.missingTracks && Array.isArray(scanResults.missingTracks)
        ? scanResults.missingTracks
        : [];
    const allTracks = [...foundTracks, ...missingTracks];

    console.log("✅ Detailed scan results fetched successfully:", {
      scanId,
      totalTracks: allTracks.length,
      foundTracks: foundTracks.length,
      missingTracks: missingTracks.length,
    });

    // Log what we're actually returning
    console.log("🔍 Returning to frontend:", {
      foundTracksLength: foundTracks.length,
      missingTracksLength: missingTracks.length,
      foundTracksSample: foundTracks[0],
      missingTracksSample: missingTracks[0],
    });

    res.json({
      scan: scanHistory,
      tracks: allTracks,
      foundTracks,
      missingTracks,
    });
  } catch (error) {
    console.error("❌ Error in detailed scan results endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete individual scan history item
app.delete("/api/scan-history/:scanId", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const scanId = req.params.scanId;

    console.log("🗑️ Deleting scan history item:", scanId, "for user:", userId);

    // First verify the scan belongs to the user
    const { data: scanHistory, error: scanError } = await supabase
      .from("scan_history")
      .select("id")
      .eq("id", scanId)
      .eq("user_id", userId)
      .single();

    if (scanError || !scanHistory) {
      console.error("❌ Scan not found or access denied:", scanError);
      return res.status(404).json({ error: "Scan not found" });
    }

    // Delete the scan
    const { error: deleteError } = await supabase
      .from("scan_history")
      .delete()
      .eq("id", scanId)
      .eq("user_id", userId);

    if (deleteError) {
      console.error("❌ Error deleting scan:", deleteError);
      return res.status(500).json({ error: "Failed to delete scan" });
    }

    console.log("✅ Scan history item deleted successfully:", scanId);
    res.json({ success: true, message: "Scan deleted successfully" });
  } catch (error) {
    console.error("❌ Error in delete scan endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete all scan history for a user
app.delete("/api/scan-history", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log("🗑️ Deleting all scan history for user:", userId);

    // Delete all scans for the user
    const { error: deleteError } = await supabase
      .from("scan_history")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error("❌ Error deleting all scans:", deleteError);
      return res.status(500).json({ error: "Failed to delete scans" });
    }

    console.log("✅ All scan history deleted successfully for user:", userId);
    res.json({ success: true, message: "All scans deleted successfully" });
  } catch (error) {
    console.error("❌ Error in delete all scans endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Downgrade user to free tier
app.post("/api/downgrade-to-free", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    console.log("🔄 Downgrading user to free tier:", userEmail);

    // Get the user's machine record
    const { machineOperations } = require("./supabase-client");
    const { data: machine, error: machineError } =
      await machineOperations.getMachineByEmail(userEmail);

    if (machineError) {
      console.error("❌ Error fetching machine data:", machineError);
      return res.status(500).json({
        error: "Failed to fetch user data",
        message: "Please try again",
      });
    }

    if (!machine) {
      console.error("❌ No machine record found for user:", userEmail);
      return res.status(404).json({
        error: "User not found",
        message: "Please complete onboarding first",
      });
    }

    // Update the user's role to "free"
    const { error: updateError } = await machineOperations.updateMachine(
      machine.id,
      {
        role: "free",
        updated_at: new Date().toISOString(),
      }
    );

    if (updateError) {
      console.error("❌ Error updating user role:", updateError);
      return res.status(500).json({
        error: "Failed to update user role",
        message: "Please try again",
      });
    }

    console.log("✅ User successfully downgraded to free tier:", userEmail);
    res.json({
      success: true,
      message: "Successfully switched to free user",
      subscriptionStatus: "free",
    });
  } catch (error) {
    console.error("❌ Error in downgrade to free endpoint:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Please try again",
    });
  }
});

// Reset trial for testing (temporary endpoint)
app.post("/api/reset-trial", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    console.log("🔄 Resetting trial for user:", userEmail);

    // Get the user's machine record
    const { machineOperations } = require("./supabase-client");
    const { data: machine, error: machineError } =
      await machineOperations.getMachineByEmail(userEmail);

    if (machineError) {
      console.error("❌ Error fetching machine data:", machineError);
      return res.status(500).json({
        error: "Failed to fetch user data",
        message: "Please try again",
      });
    }

    if (!machine) {
      console.error("❌ No machine record found for user:", userEmail);
      return res.status(404).json({
        error: "User not found",
        message: "Please complete onboarding first",
      });
    }

    // Reset trial to 7 days from now
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    // Update the user's trial
    const { error: updateError } = await machineOperations.updateMachine(
      machine.id,
      {
        role: "trial",
        trial_start: new Date().toISOString(),
        trial_end: trialEndDate.toISOString(),
        updated_at: new Date().toISOString(),
      }
    );

    if (updateError) {
      console.error("❌ Error updating trial:", updateError);
      return res.status(500).json({
        error: "Failed to reset trial",
        message: "Please try again",
      });
    }

    console.log("✅ Trial successfully reset for user:", userEmail);
    res.json({
      success: true,
      message: "Trial reset successfully",
      trial_end: trialEndDate.toISOString(),
      subscriptionStatus: "trial",
    });
  } catch (error) {
    console.error("❌ Error in reset trial endpoint:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Please try again",
    });
  }
});

// Add static file serving
if (staticServed) {
  app.use(express.static(publicPath));
  console.log(`✅ Static files now being served from: ${publicPath}`);
}

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown handling
let isShuttingDown = false;

const gracefulShutdown = (signal) => {
  if (isShuttingDown) {
    console.log(`${signal} received again, forcing exit...`);
    process.exit(1);
  }

  isShuttingDown = true;
  console.log(`${signal} received, shutting down gracefully...`);

  // Clear any intervals
  if (cacheCleanupInterval) {
    clearInterval(cacheCleanupInterval);
    console.log("Cache cleanup interval cleared");
  }

  // Close server with timeout
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.log("Forcing shutdown after timeout...");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown("UNHANDLED_REJECTION");
});
