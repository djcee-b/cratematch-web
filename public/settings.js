// Global state
console.log("🚀 Settings page - Script loaded");
let currentUser = null;
let authToken = null;

// DOM elements (will be initialized after DOM loads)
let loadingOverlay, headerNav, signOutBtn;
let settingsModal,
  settingsClose,
  settingsUploadArea,
  settingsUploadBtn,
  settingsDatabaseFile,
  settingsUploadStatus,
  settingsUploadMessage;
let freeSubscriptionSection,
  trialSubscriptionSection,
  premiumSubscriptionSection,
  freePlanActionBtn,
  manageSubscriptionBtn,
  resetTrialBtn;
let accountEmail, accountType, memberSince;
let trialExpirationModal, trialUpgradeBtn, trialFreeBtn, trialRemindBtn;

// Initialize DOM elements
function initializeDOMElements() {
  console.log("🔧 Settings page - Initializing DOM elements");

  // Loading and user elements
  loadingOverlay = document.getElementById("loading-overlay");
  headerNav = document.getElementById("header-nav");
  signOutBtn = document.getElementById("sign-out-btn");

  // Settings elements
  settingsModal = document.getElementById("settings-modal");
  settingsClose = document.getElementById("settings-close");
  settingsUploadArea = document.getElementById("settings-upload-area");
  settingsUploadBtn = document.getElementById("settings-upload-btn");
  settingsDatabaseFile = document.getElementById("settingsDatabaseFile");
  settingsUploadStatus = document.getElementById("settings-upload-status");
  settingsUploadMessage = document.getElementById("settings-upload-message");

  // Subscription elements
  freeSubscriptionSection = document.getElementById(
    "free-subscription-section"
  );
  trialSubscriptionSection = document.getElementById(
    "trial-subscription-section"
  );
  premiumSubscriptionSection = document.getElementById(
    "premium-subscription-section"
  );
  freePlanActionBtn = document.getElementById("free-plan-action-btn");
  manageSubscriptionBtn = document.getElementById("manage-subscription-btn");
  resetTrialBtn = document.getElementById("reset-trial-btn");

  // Account elements
  accountEmail = document.getElementById("account-email");
  accountType = document.getElementById("account-type");
  memberSince = document.getElementById("member-since");

  // Trial expiration modal elements
  trialExpirationModal = document.getElementById("trial-expiration-modal");
  trialUpgradeBtn = document.getElementById("trial-upgrade-btn");
  trialFreeBtn = document.getElementById("trial-free-btn");
  trialRemindBtn = document.getElementById("trial-remind-btn");

  // Debug DOM elements
  console.log(
    "🔧 Settings page - Trial section element:",
    trialSubscriptionSection
  );
  console.log("🔧 Settings page - Header nav element:", headerNav);
}

// Check authentication on page load
async function checkAuth() {
  console.log("🔐 Settings page - Starting auth check");
  const token = localStorage.getItem("authToken");
  if (!token) {
    console.log("🔐 Settings page - No token found, redirecting to auth");
    window.location.href = "/auth.html";
    return;
  }

  try {
    console.log("🔐 Settings page - Making auth request to /api/auth/verify");
    const response = await fetch("/api/auth/verify", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log("🔐 Settings page - Auth response status:", response.status);

    if (response.ok) {
      const userData = await response.json();
      console.log("🔐 Settings page - Auth successful, user data:", userData);
      currentUser = userData.user;
      currentUser.subscriptionStatus = userData.subscriptionStatus; // Add subscription status to user object
      authToken = token;

      // Update UI
      console.log("🔧 Settings page - Calling updateUserInterface");
      updateUserInterface();
      console.log("🔧 Settings page - Calling updateSubscriptionDisplay");
      updateSubscriptionDisplay();

      // Start heartbeat mechanism
      console.log("🔧 Settings page - Starting heartbeat");
      startHeartbeat();
    } else if (response.status === 403) {
      console.log(
        "🔐 Settings page - Got 403 response, checking for trial expiration"
      );
      // Handle trial expiration gracefully
      try {
        const errorData = await response.json();
        console.log("🔐 Settings page - 403 error data:", errorData);
        if (errorData.trialExpired) {
          console.log("🔐 Settings page - Trial expired, showing modal");
          // Show trial expiration modal instead of logging out
          showTrialExpirationModal();
          // Still load the interface so user can see the modal
          const data = await fetch("/api/auth/verify", {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => (r.ok ? r.json() : null));

          if (data) {
            currentUser = data.user;
            currentUser.subscriptionStatus = data.subscriptionStatus;
            authToken = token;
            updateUserInterface();
            updateSubscriptionDisplay();
          }
          return;
        }
      } catch (parseError) {
        console.error("Error parsing 403 response:", parseError);
      }

      // Other 403 errors - redirect to auth
      console.log("🔐 Settings page - Other 403 error, redirecting to auth");
      localStorage.removeItem("authToken");
      window.location.href = "/auth.html";
    } else {
      // Other errors - redirect to auth page
      console.log(
        "🔐 Settings page - Other error (status:",
        response.status,
        "), redirecting to auth"
      );
      localStorage.removeItem("authToken");
      window.location.href = "/auth.html";
    }
  } catch (error) {
    console.error("🔐 Settings page - Auth check error:", error);
    // Only logout on network errors, not auth errors
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      // Network error - don't logout, just show error
      console.log(
        "🔐 Settings page - Network error during auth check, retrying..."
      );
      setTimeout(checkAuth, 5000); // Retry in 5 seconds
      return;
    }
    console.log("🔐 Settings page - Non-network error, redirecting to auth");
    localStorage.removeItem("authToken");
    window.location.href = "/auth.html";
  }
}

// Update user interface
function updateUserInterface() {
  try {
    console.log(
      "🔧 Settings page - updateUserInterface called, currentUser:",
      currentUser
    );
    if (!currentUser) {
      console.log("🔧 Settings page - No currentUser, returning");
      return;
    }

    // Update account info
    console.log("🔧 Settings page - Updating account info");
    if (accountEmail) {
      console.log("🔧 Settings page - Setting account email");
      accountEmail.textContent = currentUser.email;
    } else {
      console.error("🔧 Settings page - accountEmail element not found!");
    }

    if (accountType) {
      console.log("🔧 Settings page - Setting account type");
      const status = currentUser.subscriptionStatus || "free";
      accountType.textContent =
        status.charAt(0).toUpperCase() + status.slice(1);
    } else {
      console.error("🔧 Settings page - accountType element not found!");
    }

    if (memberSince) {
      console.log("🔧 Settings page - Setting member since");
      const createdAt = new Date(currentUser.created_at || Date.now());
      memberSince.textContent = createdAt.toLocaleDateString();
    } else {
      console.error("🔧 Settings page - memberSince element not found!");
    }

    // Hide loading overlay
    console.log("🔧 Settings page - Attempting to hide loading overlay");
    if (loadingOverlay) {
      console.log("🔧 Settings page - Hiding loading overlay");
      loadingOverlay.style.display = "none";
    } else {
      console.error("🔧 Settings page - Loading overlay element not found!");
    }

    // Show header navigation
    console.log("🔧 Settings page - Attempting to show header navigation");
    if (headerNav) {
      console.log("🔧 Settings page - Showing header navigation");
      headerNav.style.display = "flex";
    } else {
      console.error("🔧 Settings page - Header nav element not found!");
    }
  } catch (error) {
    console.error("🔧 Settings page - Error in updateUserInterface:", error);
  }
}

// Update subscription display based on user role
function updateSubscriptionDisplay() {
  try {
    console.log(
      "🔧 Settings page - updateSubscriptionDisplay called, currentUser:",
      currentUser
    );
    if (!currentUser) {
      console.log(
        "🔧 Settings page - No currentUser in updateSubscriptionDisplay, returning"
      );
      return;
    }

    const status = currentUser.subscriptionStatus || "free";
    console.log("Settings page - User subscription status:", status);
    console.log("Settings page - Current user object:", currentUser);

    // Hide all sections first
    if (freeSubscriptionSection) freeSubscriptionSection.style.display = "none";
    if (trialSubscriptionSection)
      trialSubscriptionSection.style.display = "none";
    if (premiumSubscriptionSection)
      premiumSubscriptionSection.style.display = "none";

    // Show appropriate section
    switch (status) {
      case "free":
        console.log("Settings page - Showing FREE section");
        if (freeSubscriptionSection) {
          freeSubscriptionSection.style.display = "block";
          console.log("Settings page - FREE section displayed");
        } else {
          console.error("Settings page - FREE section element not found!");
        }
        if (freePlanActionBtn) {
          freePlanActionBtn.textContent = "Upgrade to Pro";
          freePlanActionBtn.onclick = () => {
            window.location.href = "/pricing.html";
          };
        }
        break;

      case "trial":
        console.log("Settings page - Showing TRIAL section");
        if (trialSubscriptionSection) {
          trialSubscriptionSection.style.display = "block";
          console.log("Settings page - TRIAL section displayed");
        } else {
          console.error("Settings page - TRIAL section element not found!");
        }
        // Update trial countdown if available
        updateTrialCountdown();
        break;

      case "premium":
        if (premiumSubscriptionSection) {
          premiumSubscriptionSection.style.display = "block";
        }
        if (manageSubscriptionBtn) {
          manageSubscriptionBtn.style.display = "block";
        }
        break;

      default:
        if (freeSubscriptionSection) {
          freeSubscriptionSection.style.display = "block";
        }
    }
  } catch (error) {
    console.error(
      "🔧 Settings page - Error in updateSubscriptionDisplay:",
      error
    );
  }
}

// Trial countdown timer

// Trial expiration modal functions
function showTrialExpirationModal() {
  if (trialExpirationModal) {
    trialExpirationModal.style.display = "flex";
  }
}

// Check if we should show trial expiration modal
function checkTrialExpirationReminder() {
  const remindLater = localStorage.getItem("trialExpirationRemindLater");
  if (remindLater) {
    const remindTime = parseInt(remindLater);
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    if (now - remindTime > twentyFourHours) {
      // 24 hours have passed, show the modal again
      localStorage.removeItem("trialExpirationRemindLater");
      return true;
    }
  }
  return false;
}

// Heartbeat mechanism to keep session alive
function startHeartbeat() {
  // Send a heartbeat every 5 minutes to keep the session active
  setInterval(async () => {
    if (!authToken) return;

    try {
      const response = await fetch("/api/auth/verify", {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        console.log("💓 Heartbeat successful");
      } else {
        console.warn("⚠️ Heartbeat failed, session may be expiring");
      }
    } catch (error) {
      console.error("❌ Heartbeat error:", error);
    }
  }, 5 * 60 * 1000); // 5 minutes

  console.log("💓 Heartbeat mechanism started");
}

// Initialize event listeners
function initializeEventListeners() {
  // Modal close buttons
  if (settingsClose) {
    settingsClose.addEventListener("click", () => {
      if (settingsModal) {
        settingsModal.style.display = "none";
      }
    });
  }

  // Close modals when clicking outside
  if (settingsModal) {
    settingsModal.addEventListener("click", (e) => {
      if (e.target === settingsModal) {
        settingsModal.style.display = "none";
      }
    });
  }

  // Manage subscription button
  if (manageSubscriptionBtn) {
    manageSubscriptionBtn.addEventListener("click", handleManageSubscription);
  }

  // Reset trial button
  if (resetTrialBtn) {
    resetTrialBtn.addEventListener("click", handleResetTrial);
  }

  // Sign out button
  if (signOutBtn) {
    signOutBtn.addEventListener("click", handleSignOut);
  }

  // File upload handlers
  setupFileUpload();

  // Trial expiration modal event listeners
  if (trialUpgradeBtn) {
    trialUpgradeBtn.addEventListener("click", () => {
      window.location.href = "/pricing.html";
    });
  }

  if (trialFreeBtn) {
    trialFreeBtn.addEventListener("click", async () => {
      try {
        const response = await fetch("/api/downgrade-to-free", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (response.ok) {
          // Hide the modal
          if (trialExpirationModal) {
            trialExpirationModal.style.display = "none";
          }

          // Refresh the page to update the UI
          window.location.reload();
        } else {
          console.error("Failed to downgrade to free user");
          alert("Failed to switch to free user. Please try again.");
        }
      } catch (error) {
        console.error("Error downgrading to free user:", error);
        alert("Failed to switch to free user. Please try again.");
      }
    });
  }

  if (trialRemindBtn) {
    trialRemindBtn.addEventListener("click", () => {
      // Hide the modal but don't change anything
      if (trialExpirationModal) {
        trialExpirationModal.style.display = "none";
      }

      // Set a flag to show the modal again in 24 hours
      localStorage.setItem("trialExpirationRemindLater", Date.now().toString());
    });
  }
}

// Handle manage subscription
async function handleManageSubscription() {
  try {
    const response = await fetch("/api/stripe/create-portal-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to create portal session");
    }

    const { url } = await response.json();

    // Open Stripe Customer Portal in new window
    window.open(url, "_blank");
  } catch (error) {
    console.error("Error creating portal session:", error);
    alert("Failed to open subscription management. Please try again.");
  }
}

// Handle reset trial
async function handleResetTrial() {
  try {
    console.log("🔄 Resetting trial...");

    const response = await fetch("/api/reset-trial", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to reset trial");
    }

    const result = await response.json();
    console.log("✅ Trial reset successful:", result);

    alert("Trial reset successfully! Your trial now expires in 7 days.");

    // Refresh the page to update the UI
    window.location.reload();
  } catch (error) {
    console.error("Error resetting trial:", error);
    alert("Failed to reset trial. Please try again.");
  }
}

// Setup file upload functionality
function setupFileUpload() {
  if (settingsUploadArea && settingsDatabaseFile) {
    settingsUploadArea.addEventListener("click", () => {
      settingsDatabaseFile.click();
    });

    settingsDatabaseFile.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        handleFileUpload(e.target.files[0]);
      }
    });

    settingsUploadBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      settingsDatabaseFile.click();
    });
  }
}

// Handle file upload
async function handleFileUpload(file) {
  if (!isValidDatabaseFile(file)) {
    showUploadStatus(
      "Please select a file named 'database V2'. Only files with this exact name are accepted.",
      "error"
    );
    return;
  }

  try {
    showUploadStatus("Uploading new database file...", "loading");
    settingsUploadBtn.disabled = true;

    const formData = new FormData();
    formData.append("database", file);

    const response = await fetch("/upload-database", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (response.ok) {
      showUploadStatus("✅ Database updated successfully!", "success");
      // Close modal after a delay
      setTimeout(() => {
        if (settingsModal) {
          settingsModal.style.display = "none";
        }
      }, 2000);
    } else {
      if (response.status === 403 && data.trialExpired) {
        showTrialExpirationModal();
      } else {
        showUploadStatus(
          data.message || "Upload failed. Please try again.",
          "error"
        );
      }
    }
  } catch (error) {
    console.error("File upload error:", error);
    showUploadStatus("Upload failed. Please try again.", "error");
  } finally {
    settingsUploadBtn.disabled = false;
  }
}

// Validate database file
function isValidDatabaseFile(file) {
  // Only accept files named "database V2"
  return file && file.size > 0 && file.name === "database V2";
}

// Show upload status
function showUploadStatus(message, type) {
  if (settingsUploadMessage) {
    settingsUploadMessage.textContent = message;
  }
  if (settingsUploadStatus) {
    settingsUploadStatus.className = `upload-status ${type}`;
    settingsUploadStatus.style.display = "block";
  }
}

// Handle sign out
async function handleSignOut() {
  try {
    localStorage.removeItem("authToken");
    window.location.href = "/auth.html";
  } catch (error) {
    console.error("Sign out error:", error);
    // Force redirect anyway
    window.location.href = "/auth.html";
  }
}

// Initialize page
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Settings page - DOM content loaded");
  initializeDOMElements();
  checkAuth();
  initializeEventListeners();

  // Check if we should show trial expiration reminder
  if (checkTrialExpirationReminder()) {
    showTrialExpirationModal();
  }
});
