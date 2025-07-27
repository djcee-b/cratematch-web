const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { importSpotifyPlaylist } = require("@musiclibrarytools/mlt.js");
const {
  authOperations,
  storageOperations,
  machineOperations,
} = require("./supabase-client");
const { requireAuth, requireActiveSubscription } = require("./auth-middleware");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

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
          if (file === '.gitkeep' || stats.isDirectory()) {
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
      const userDir = path.join(cacheDir, userId);
      cleanupUserCache(userDir);

      // Remove empty user directories (excluding .gitkeep files)
      if (fs.existsSync(userDir)) {
        const files = fs.readdirSync(userDir);
        const nonGitkeepFiles = files.filter(file => file !== '.gitkeep');
        
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
setInterval(cleanupExpiredCache, 60 * 60 * 1000);
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

// Get current user and subscription status
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

      const fileName = `database-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      console.log("About to upload to Supabase storage");
      console.log("File path:", `databases/${req.user.id}/${fileName}`);

      // Get the user's access token from the request headers
      const authHeader = req.headers.authorization;
      const accessToken = authHeader ? authHeader.substring(7) : null;

      console.log("Access token present:", !!accessToken);

      // Upload to Supabase storage
      await storageOperations.uploadDatabase(
        req.user.id,
        req.file.buffer,
        fileName,
        accessToken
      );

      console.log("Upload successful!");

      // Also save locally for MLT.js processing
      const localPath = path.join(uploadsDir, fileName);
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
    try {
      const { playlistUrl, threshold = 90, databaseFileName } = req.body;

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
      if (error.message && error.message.includes("Free users are limited to importing playlists with 50 tracks or fewer")) {
        errorMessage = "Free users can only process playlists with 50 tracks or fewer. Please upgrade to Premium for unlimited processing.";
      }

      res.status(500).json({
        error: "Processing failed",
        message: errorMessage,
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

// Process playlist with progress updates (Server-Sent Events)
app.get(
  "/process-playlist-progress",
  requireAuthForProgress,
  requireActiveSubscriptionForProgress,
  async (req, res) => {
    // Extract variables outside try block so they're available in catch
    const { playlistUrl, threshold, databaseFileName } = req.query;

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
          progress: 0,
          message: "Loading database...",
        })}\n\n`
      );

      // Get or download cached database
      const localDatabasePath = await getOrDownloadDatabase(
        req.user.id,
        databaseFileName,
        accessToken
      );

      res.write(
        `data: ${JSON.stringify({
          type: "progress",
          progress: 10,
          message: "Database loaded, starting playlist processing...",
        })}\n\n`
      );

      console.log(`Using database: ${localDatabasePath}`);
      console.log(`Threshold: ${threshold}`);

      // Process the playlist with progress updates
      const results = await importSpotifyPlaylist(
        playlistUrl,
        (progress) => {
          console.log("Progress callback received:", progress);
          console.log("Progress type:", typeof progress);
          console.log("Progress constructor:", progress?.constructor?.name);

          // Handle different progress formats
          let progressPercent;
          let message;

          if (typeof progress === "number") {
            // If progress is a number, assume it's already a percentage (0-100)
            progressPercent = Math.min(90, Math.max(10, progress));
            message = `Processing playlist... ${Math.round(progressPercent)}%`;
          } else if (progress && typeof progress === "object") {
            // If progress is an object with percentage property
            if (typeof progress.current === "number" && typeof progress.total === "number") {
              progressPercent = progress.current / progress.total * 100;
            } else if (progress.percentage !== undefined) {
              progressPercent = Math.min(90, Math.max(10, progress.percentage));
            } else if (progress.progress !== undefined) {
              progressPercent = Math.min(90, Math.max(10, progress.progress));
            } else {
              progressPercent = 50; // Default fallback
            }
            message =
              progress.message ||
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
              progress ||
              `Processing playlist... ${Math.round(progressPercent)}%`;
          }

          console.log(`Sending progress: ${progressPercent}% - ${message}`);

          res.write(
            `data: ${JSON.stringify({
              type: "progress",
              progress: Math.round(progressPercent),
              message: message,
            })}\n\n`
          );
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
        })}\n\n`
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

      res.write(
        `data: ${JSON.stringify({
          type: "progress",
          progress: 100,
          message: "Complete!",
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

      res.end();
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
      if (error.message && error.message.includes("Free users are limited to importing playlists with 50 tracks or fewer")) {
        errorMessage = "Free users can only process playlists with 50 tracks or fewer. Please upgrade to Premium for unlimited processing.";
      }

      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error: "Processing failed",
          message: errorMessage,
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

// Cleanup uploaded files (optional)
app.delete("/cleanup/:sessionId", requireAuth, async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const uploadPath = path.join(uploadsDir, sessionId);

    if (fs.existsSync(uploadPath)) {
      fs.unlinkSync(uploadPath);
    }

    res.json({
      success: true,
      message: "Cleanup completed",
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    res.status(500).json({
      error: "Cleanup failed",
      message: "Please try again",
    });
  }
});

// Manual cache cleanup endpoint (for testing)
app.post("/cleanup-cache", requireAuth, async (req, res) => {
  try {
    cleanupExpiredCache();
    res.json({
      success: true,
      message: "Cache cleanup completed",
    });
  } catch (error) {
    console.error("Cache cleanup error:", error);
    res.status(500).json({
      error: "Cache cleanup failed",
      message: "Please try again",
    });
  }
});

// Manual cleanup of temporary database files
app.post("/cleanup-temp-databases", requireAuth, async (req, res) => {
  try {
    let cleanedCount = 0;
    const files = fs.readdirSync(uploadsDir);

    files.forEach((file) => {
      if (file.startsWith("database-") && file.includes("-")) {
        const filePath = path.join(uploadsDir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up temporary database: ${file}`);
          cleanedCount++;
        } catch (error) {
          console.error(`Failed to clean up ${file}:`, error);
        }
      }
    });

    res.json({
      success: true,
      message: `Cleaned up ${cleanedCount} temporary database files`,
      cleanedCount: cleanedCount,
    });
  } catch (error) {
    console.error("Temp database cleanup error:", error);
    res.status(500).json({
      error: "Temp database cleanup failed",
      message: "Please try again",
    });
  }
});

// Serve the onboarding page
app.get("/onboarding", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "onboarding.html"));
});

// Serve the main application
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
