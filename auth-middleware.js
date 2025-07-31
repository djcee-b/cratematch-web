const { authOperations } = require("./supabase-client");

// Middleware to check if user is authenticated
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Please sign in to continue",
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

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

// Middleware to check if user has active subscription or trial
const requireActiveSubscription = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Please sign in to continue",
      });
    }

    // Get user's machine record to check subscription status
    // For web users, we find machine by email to avoid duplicate records
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
      // No machine record found by email - create new one with trial
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 7); // 7-day trial

      // Generate a unique machine ID for this user
      const { generateWebMachineId } = require("./supabase-client");
      const machineId = generateWebMachineId(req.user.id);

      const machineData = {
        id: machineId,
        user_id: req.user.id,
        email: req.user.email,
        trial_start: new Date().toISOString(),
        trial_end: trialEndDate.toISOString(),
        role: "trial",
        last_seen: new Date().toISOString(),
      };

      console.log("Creating new machine record with trial:", machineData);

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

      req.machine = machineData;
      return next();
    }

    // Update last_seen timestamp for existing machine
    const { error: updateError } = await machineOperations.updateMachine(
      machine.id,
      { last_seen: new Date().toISOString() }
    );
    if (updateError) {
      console.error("Error updating last_seen:", updateError);
    }

    // Check if user is in trial period
    const now = new Date();
    const trialEnd = new Date(machine.trial_end);

    if (machine.role === "trial" && now < trialEnd) {
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
            req.machine = {
              ...machine,
              role: "free",
              subscription_type: null,
            };
            return next();
          }

          // Update the machine object with new role
          req.machine = {
            ...machine,
            role: "free",
            subscription_type: null,
          };
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
      req.machine = machine;
      return next();
    }

    // Check if user has free access
    if (machine.role === "free") {
      req.machine = machine;
      return next();
    }

    // User's trial has expired - automatically downgrade to free instead of blocking
    if (machine.role === "trial" && now >= trialEnd) {
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
        req.machine = { ...machine, role: "free" };
        return next();
      }

      // Update the machine object with new role
      req.machine = { ...machine, role: "free" };
      console.log("✅ User auto-downgraded to free:", req.user.email);

      // Set a flag in the response to indicate auto-downgrade
      res.setHeader("X-Auto-Downgraded", "true");
      return next();
    }

    // Unknown role - treat as free user
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

// Optional auth middleware - doesn't block if not authenticated
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(); // Continue without user
    }

    const token = authHeader.substring(7);
    const { supabase } = require("./supabase-client");
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (!error && user) {
      req.user = user;
    }

    next();
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    next(); // Continue without user
  }
};

module.exports = {
  requireAuth,
  requireActiveSubscription,
  optionalAuth,
};
