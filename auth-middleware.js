const { authOperations } = require("./supabase-client");

// Session caching to reduce authentication overhead
const sessionCache = new Map();
const subscriptionCache = new Map();
const SESSION_CACHE_TTL = 15 * 60 * 1000; // 15 minutes (increased from 10)
const SUBSCRIPTION_CACHE_TTL = 10 * 60 * 1000; // 10 minutes (increased from 5)
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // Refresh tokens 5 minutes before expiry

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  
  // Clean session cache
  for (const [token, data] of sessionCache.entries()) {
    if (now - data.timestamp > SESSION_CACHE_TTL) {
      sessionCache.delete(token);
    }
  }
  
  // Clean subscription cache
  for (const [key, data] of subscriptionCache.entries()) {
    if (now - data.timestamp > SUBSCRIPTION_CACHE_TTL) {
      subscriptionCache.delete(key);
    }
  }
}, 300000); // Run cleanup every 5 minutes (increased from 2)

// Helper function to refresh token if needed
async function refreshTokenIfNeeded(token, user) {
  const now = Date.now();
  const tokenExpiry = user?.exp || 0;
  const timeUntilExpiry = tokenExpiry * 1000 - now;
  
  // If token expires within threshold, try to refresh
  if (timeUntilExpiry < TOKEN_REFRESH_THRESHOLD && timeUntilExpiry > 0) {
    try {
      const { supabase } = require("./supabase-client");
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: user?.refresh_token
      });
      
      if (!error && data.session) {
        // Update cache with new token
        sessionCache.set(data.session.access_token, {
          user: data.user,
          timestamp: now,
          session: data.session
        });
        return data.session.access_token;
      }
    } catch (error) {
      console.warn('Token refresh failed:', error.message);
    }
  }
  
  return token;
}

// Helper function to retry Supabase calls
async function retrySupabaseCall(callFn, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await callFn();
      return result;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      // Wait before retry (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Middleware to check if user is authenticated
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Please sign in to access this resource",
      });
    }

    const token = authHeader.substring(7);
    
    // Check session cache first
    const cachedSession = sessionCache.get(token);
    if (cachedSession && Date.now() - cachedSession.timestamp < SESSION_CACHE_TTL) {
      // Check if token needs refresh
      const refreshedToken = await refreshTokenIfNeeded(token, cachedSession.user);
      if (refreshedToken !== token) {
        // Update the request with new token
        req.headers.authorization = `Bearer ${refreshedToken}`;
      }
      req.user = cachedSession.user;
      return next();
    }

    const { supabase } = require("./supabase-client");
    const {
      data: { user },
      error,
    } = await retrySupabaseCall(() => supabase.auth.getUser(token));

    if (error || !user) {
      return res.status(401).json({
        error: "Invalid token",
        message: "Please sign in again",
      });
    }

    // Check if token needs refresh
    const refreshedToken = await refreshTokenIfNeeded(token, user);
    
    // Cache the session
    sessionCache.set(refreshedToken, {
      user,
      timestamp: Date.now(),
      session: { access_token: refreshedToken }
    });

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

// Middleware to check if user has active subscription or trial
const requireActiveSubscription = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Please sign in to continue",
      });
    }

    // Check subscription cache first
    const subscriptionCacheKey = `subscription_${req.user.email}`;
    const cachedSubscription = subscriptionCache.get(subscriptionCacheKey);
    if (
      cachedSubscription &&
      Date.now() - cachedSubscription.timestamp < SUBSCRIPTION_CACHE_TTL
    ) {
      req.machine = cachedSubscription.machine;
      return next();
    }

    // Get user's machine record to check subscription status
    // For web users, we find machine by email to avoid duplicate records
    const { machineOperations } = require("./supabase-client");
    const { data: machine, error } = await machineOperations.getMachineByEmail(
      req.user.email
    );

    console.log(`🔍 MACHINE LOOKUP for ${req.user.email}:`, {
      found: !!machine,
      error: error ? error.message : null,
      machineData: machine
        ? {
            id: machine.id,
            role: machine.role,
            trial_start: machine.trial_start,
            trial_end: machine.trial_end,
          }
        : null,
    });

    if (error) {
      console.error("Error fetching machine data:", error);
      return res.status(500).json({
        error: "Subscription check failed",
        message: "Please try again",
      });
    }

    if (!machine) {
      // No machine record found by email - create new one with trial
      const now = new Date();
      const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      // Generate a unique machine ID for this user
      const { generateWebMachineId } = require("./supabase-client");
      const machineId = generateWebMachineId(req.user.id);

      const machineData = {
        id: machineId,
        user_id: req.user.id,
        email: req.user.email,
        trial_start: now.toISOString(),
        trial_end: trialEndDate.toISOString(),
        role: "trial",
        last_seen: now.toISOString(),
        exports_today: 0,
        last_export_date: now.toISOString().split("T")[0], // Today's date in YYYY-MM-DD format
      };

      console.log("🔧 CREATING NEW TRIAL USER:", {
        email: req.user.email,
        trial_start: now.toISOString(),
        trial_end: trialEndDate.toISOString(),
        now_iso: now.toISOString(),
        trial_end_iso: trialEndDate.toISOString(),
        timeDiff_ms: trialEndDate.getTime() - now.getTime(),
        timeDiff_days:
          (trialEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        now_date: now.toDateString(),
        trial_end_date: trialEndDate.toDateString(),
      });

      const { error: upsertError } = await machineOperations.upsertMachine(
        machineData
      );
      if (upsertError) {
        console.error("Error creating machine record:", upsertError);
        return res.status(500).json({
          error: "Account setup failed",
          message: "Please try again",
        });
      }

      // Cache the new machine data
      subscriptionCache.set(subscriptionCacheKey, {
        machine: machineData,
        timestamp: Date.now(),
      });
      req.machine = machineData;
      return next();
    }

    // Update last_seen timestamp for existing machine (but don't block on this)
    machineOperations
      .updateMachine(machine.id, { last_seen: new Date().toISOString() })
      .catch((error) => {
        console.error("Error updating last_seen:", error);
      });

    // Check if user is in trial period
    const now = new Date();
    const trialEnd = machine.trial_end ? new Date(machine.trial_end) : null;

    // Debug trial date comparison
    console.log(`🔍 TRIAL CHECK for ${req.user.email}:`, {
      role: machine.role,
      trial_start: machine.trial_start,
      trial_end: machine.trial_end,
      now_iso: now.toISOString(),
      trialEnd_iso: trialEnd ? trialEnd.toISOString() : "null",
      isTrial: machine.role === "trial",
      isExpired: machine.role === "trial" && trialEnd ? now >= trialEnd : false,
      timeDiff_ms: trialEnd ? trialEnd.getTime() - now.getTime() : null,
      timeDiff_days: trialEnd
        ? (trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        : null,
      now_date: now.toDateString(),
      trial_end_date: trialEnd ? trialEnd.toDateString() : "null",
    });

    if (machine.role === "trial" && trialEnd && now < trialEnd) {
      // Cache the machine data
      subscriptionCache.set(subscriptionCacheKey, {
        machine,
        timestamp: Date.now(),
      });
      req.machine = machine;
      return next();
    }

    // Check if user has active subscription
    if (machine.role === "premium") {
      // Check if premium subscription has expired
      if (machine.subscription_end) {
        const subscriptionEnd = new Date(machine.subscription_end);
        const now = new Date();

        if (now >= subscriptionEnd) {
          console.log(
            "🔄 Premium subscription expired for user:",
            req.user.email,
            "- auto-downgrading to free"
          );

          // Automatically downgrade to free user
          const { error: updateError } = await machineOperations.updateMachine(
            machine.id,
            {
              role: "free",
              subscription_type: null,
              subscription_start: null,
              subscription_end: null,
            }
          );

          if (updateError) {
            console.error(
              "❌ Error auto-downgrading premium user:",
              updateError
            );
            // If downgrade fails, still allow access but log the error
            const updatedMachine = {
              ...machine,
              role: "free",
              subscription_type: null,
            };
            subscriptionCache.set(subscriptionCacheKey, {
              machine: updatedMachine,
              timestamp: Date.now(),
            });
            req.machine = updatedMachine;
            return next();
          }

          // Update the machine object with new role
          const updatedMachine = {
            ...machine,
            role: "free",
            subscription_type: null,
          };
          subscriptionCache.set(subscriptionCacheKey, {
            machine: updatedMachine,
            timestamp: Date.now(),
          });
          req.machine = updatedMachine;
          console.log(
            "✅ Premium user auto-downgraded to free:",
            req.user.email
          );

          // Set a flag in the response to indicate auto-downgrade
          res.setHeader("X-Auto-Downgraded", "true");
          return next();
        }
      }

      // Subscription is still active
      subscriptionCache.set(subscriptionCacheKey, {
        machine,
        timestamp: Date.now(),
      });
      req.machine = machine;
      return next();
    }

    // Check if user has free access
    if (machine.role === "free") {
      subscriptionCache.set(subscriptionCacheKey, {
        machine,
        timestamp: Date.now(),
      });
      req.machine = machine;
      return next();
    }

    // User's trial has expired - automatically downgrade to free instead of blocking
    if (machine.role === "trial" && trialEnd && now >= trialEnd) {
      console.log(
        "🔄 Trial expired for user:",
        req.user.email,
        "- auto-downgrading to free"
      );

      // Automatically downgrade to free user
      const { error: updateError } = await machineOperations.updateMachine(
        machine.id,
        {
          role: "free",
          trial_start: null,
          trial_end: null,
        }
      );

      if (updateError) {
        console.error("❌ Error auto-downgrading user:", updateError);
        // If downgrade fails, still allow access but log the error
        const updatedMachine = { ...machine, role: "free" };
        subscriptionCache.set(subscriptionCacheKey, {
          machine: updatedMachine,
          timestamp: Date.now(),
        });
        req.machine = updatedMachine;
        return next();
      }

      // Update the machine object with new role
      const updatedMachine = { ...machine, role: "free" };
      subscriptionCache.set(subscriptionCacheKey, {
        machine: updatedMachine,
        timestamp: Date.now(),
      });
      req.machine = updatedMachine;
      console.log("✅ User auto-downgraded to free:", req.user.email);

      // Set a flag in the response to indicate auto-downgrade
      res.setHeader("X-Auto-Downgraded", "true");
      return next();
    }

    // Unknown role - treat as free user
    subscriptionCache.set(subscriptionCacheKey, {
      machine,
      timestamp: Date.now(),
    });
    req.machine = machine;
    return next();
  } catch (error) {
    console.error("Subscription check error:", error);
    return res.status(500).json({
      error: "Subscription check failed",
      message: "Please try again",
    });
  }
};

// Middleware to check free user export limits and handle daily reset
const checkFreeUserExportLimit = async (req, res, next) => {
  try {
    if (!req.user || !req.machine) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Please sign in to continue",
      });
    }

    // Only check limits for free users
    if (req.machine.role !== "free") {
      return next(); // Premium and trial users have unlimited exports
    }

    const { machineOperations } = require("./supabase-client");
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
    const lastExportDate = req.machine.last_export_date;
    let exportsToday = req.machine.exports_today || 0;

    // Check if it's a new day and reset exports_today if needed
    if (lastExportDate !== today) {
      console.log(
        `🔄 New day detected for user ${req.user.email}, resetting exports_today from ${exportsToday} to 0`
      );

      // Reset exports for the new day
      const { error: updateError } = await machineOperations.updateMachine(
        req.machine.id,
        {
          exports_today: 0,
          last_export_date: today,
        }
      );

      if (updateError) {
        console.error("❌ Error resetting daily exports:", updateError);
        // Continue with current values if update fails
      } else {
        exportsToday = 0;
        req.machine.exports_today = 0;
        req.machine.last_export_date = today;
      }
    }

    // Check if user has exceeded daily limit (1 export for free users)
    if (exportsToday >= 1) {
      return res.status(429).json({
        error: "Daily export limit exceeded",
        message:
          "Free users can only export 1 playlist per day. Upgrade to premium for unlimited exports.",
        exports_today: exportsToday,
        limit: 1,
        showUpgrade: true,
      });
    }

    // Increment exports_today for this request
    const newExportsToday = exportsToday + 1;
    const { error: incrementError } = await machineOperations.updateMachine(
      req.machine.id,
      {
        exports_today: newExportsToday,
        last_export_date: today,
      }
    );

    if (incrementError) {
      console.error("❌ Error incrementing exports_today:", incrementError);
      // Continue with the request even if increment fails
    } else {
      req.machine.exports_today = newExportsToday;
      req.machine.last_export_date = today;
    }

    next();
  } catch (error) {
    console.error("Export limit check error:", error);
    return res.status(500).json({
      error: "Export limit check failed",
      message: "Please try again",
    });
  }
};

// Optional auth middleware - doesn't block if not authenticated
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(); // Continue without user
    }

    const token = authHeader.substring(7);
    
    // Check session cache first
    const cachedSession = sessionCache.get(token);
    if (cachedSession && Date.now() - cachedSession.timestamp < SESSION_CACHE_TTL) {
      // Check if token needs refresh
      const refreshedToken = await refreshTokenIfNeeded(token, cachedSession.user);
      if (refreshedToken !== token) {
        // Update the request with new token
        req.headers.authorization = `Bearer ${refreshedToken}`;
      }
      req.user = cachedSession.user;
      return next();
    }

    const { supabase } = require("./supabase-client");
    const {
      data: { user },
      error,
    } = await retrySupabaseCall(() => supabase.auth.getUser(token));

    if (!error && user) {
      // Check if token needs refresh
      const refreshedToken = await refreshTokenIfNeeded(token, user);
      
      // Cache the session
      sessionCache.set(refreshedToken, {
        user,
        timestamp: Date.now(),
        session: { access_token: refreshedToken }
      });
      
      req.user = user;
    }

    next();
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    next(); // Continue without user on error
  }
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window per user
const RATE_LIMIT_MAX_GLOBAL = 1000; // Max requests per window globally

// Rate limiting storage
const rateLimitStore = new Map();
const globalRateLimit = {
  count: 0,
  resetTime: Date.now() + RATE_LIMIT_WINDOW
};

// Rate limiting middleware
const rateLimit = (req, res, next) => {
  const now = Date.now();
  const userKey = req.user?.id || req.ip || 'anonymous';
  
  // Reset global counter if window expired
  if (now > globalRateLimit.resetTime) {
    globalRateLimit.count = 0;
    globalRateLimit.resetTime = now + RATE_LIMIT_WINDOW;
  }
  
  // Check global rate limit
  if (globalRateLimit.count >= RATE_LIMIT_MAX_GLOBAL) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      message: "Too many requests globally. Please try again later.",
      retryAfter: Math.ceil((globalRateLimit.resetTime - now) / 1000)
    });
  }
  
  // Get or create user rate limit entry
  let userLimit = rateLimitStore.get(userKey);
  if (!userLimit || now > userLimit.resetTime) {
    userLimit = {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW
    };
    rateLimitStore.set(userKey, userLimit);
  }
  
  // Check user rate limit
  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      message: "Too many requests. Please try again later.",
      retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
    });
  }
  
  // Increment counters
  userLimit.count++;
  globalRateLimit.count++;
  
  // Add rate limit headers
  res.set({
    'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS,
    'X-RateLimit-Remaining': RATE_LIMIT_MAX_REQUESTS - userLimit.count,
    'X-RateLimit-Reset': userLimit.resetTime,
    'X-RateLimit-Global-Remaining': RATE_LIMIT_MAX_GLOBAL - globalRateLimit.count
  });
  
  next();
};

// Clean up old rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [key, limit] of rateLimitStore.entries()) {
    if (now > limit.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

// Enhanced requireAuth with rate limiting
const requireAuthWithRateLimit = [rateLimit, requireAuth];

// Enhanced optionalAuth with rate limiting
const optionalAuthWithRateLimit = [rateLimit, optionalAuth];

// Cache management functions
const clearSessionCache = () => {
  const size = sessionCache.size;
  sessionCache.clear();
  console.log(`🧹 Cleared session cache (${size} entries)`);
};

const clearSubscriptionCache = () => {
  const size = subscriptionCache.size;
  subscriptionCache.clear();
  console.log(`🧹 Cleared subscription cache (${size} entries)`);
};

const getCacheStats = () => {
  return {
    sessionCache: {
      size: sessionCache.size,
      ttl: SESSION_CACHE_TTL,
    },
    subscriptionCache: {
      size: subscriptionCache.size,
      ttl: SUBSCRIPTION_CACHE_TTL,
    },
  };
};

// Log cache stats periodically
setInterval(() => {
  const stats = getCacheStats();
  console.log(
    `📊 Cache Stats: Sessions=${stats.sessionCache.size}, Subscriptions=${stats.subscriptionCache.size}`
  );
}, 300000); // Log every 5 minutes

module.exports = {
  requireAuth,
  optionalAuth,
  requireAuthWithRateLimit,
  optionalAuthWithRateLimit,
  rateLimit,
  requireActiveSubscription,
  clearSessionCache,
  clearSubscriptionCache,
  getCacheStats,
  refreshTokenIfNeeded,
  retrySupabaseCall,
  circuitBreaker
};
