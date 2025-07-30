// Global state
let currentUser = null;
let authToken = null;

// DOM elements
const loadingOverlay = document.getElementById("loading-overlay");
const userInfo = document.getElementById("user-info");
const userEmail = document.getElementById("user-email");
const subscriptionStatus = document.getElementById("subscription-status");

const signOutBtn = document.getElementById("sign-out-btn");

// Settings elements
const settingsModal = document.getElementById("settings-modal");
const settingsClose = document.getElementById("settings-close");
const settingsUploadArea = document.getElementById("settings-upload-area");
const settingsUploadBtn = document.getElementById("settings-upload-btn");
const settingsDatabaseFile = document.getElementById("settingsDatabaseFile");
const settingsUploadStatus = document.getElementById("settings-upload-status");
const settingsUploadMessage = document.getElementById(
  "settings-upload-message"
);

// Subscription elements
const freeSubscriptionSection = document.getElementById(
  "free-subscription-section"
);
const trialSubscriptionSection = document.getElementById(
  "trial-subscription-section"
);
const premiumSubscriptionSection = document.getElementById(
  "premium-subscription-section"
);
const freePlanActionBtn = document.getElementById("free-plan-action-btn");
const manageSubscriptionBtn = document.getElementById(
  "manage-subscription-btn"
);

// Account elements
const accountEmail = document.getElementById("account-email");
const accountType = document.getElementById("account-type");
const memberSince = document.getElementById("member-since");

// Check authentication on page load
async function checkAuth() {
  const token = localStorage.getItem("authToken");
  if (!token) {
    window.location.href = "/auth.html";
    return;
  }

  try {
    const response = await fetch("/api/auth/verify", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Invalid token");
    }

    const userData = await response.json();
    currentUser = userData.user;
    currentUser.subscriptionStatus = userData.subscriptionStatus; // Add subscription status to user object
    authToken = token;

    // Update UI
    updateUserInterface();
    updateSubscriptionDisplay();
  } catch (error) {
    console.error("Auth error:", error);
    localStorage.removeItem("authToken");
    window.location.href = "/auth.html";
  }
}

// Update user interface
function updateUserInterface() {
  if (!currentUser) return;

  // Update user info
  if (userEmail) {
    userEmail.textContent = currentUser.email;
  }

  if (subscriptionStatus) {
    const status = currentUser.subscriptionStatus || "free";
    subscriptionStatus.textContent =
      status.charAt(0).toUpperCase() + status.slice(1);
  }

  // Update account info
  if (accountEmail) {
    accountEmail.textContent = currentUser.email;
  }

  if (accountType) {
    const status = currentUser.subscriptionStatus || "free";
    accountType.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  }

  if (memberSince) {
    const createdAt = new Date(currentUser.created_at || Date.now());
    memberSince.textContent = createdAt.toLocaleDateString();
  }

  // Hide loading overlay
  if (loadingOverlay) {
    loadingOverlay.style.display = "none";
  }

  // Show user info
  if (userInfo) {
    userInfo.style.display = "flex";
  }
}

// Update subscription display based on user role
function updateSubscriptionDisplay() {
  if (!currentUser) return;

  const status = currentUser.subscriptionStatus || "free";
  console.log("Settings page - User subscription status:", status);
  console.log("Settings page - Current user object:", currentUser);

  // Hide all sections first
  if (freeSubscriptionSection) freeSubscriptionSection.style.display = "none";
  if (trialSubscriptionSection) trialSubscriptionSection.style.display = "none";
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
      if (trialSubscriptionSection) {
        trialSubscriptionSection.style.display = "block";
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
}

// Update trial countdown
function updateTrialCountdown() {
  if (!currentUser || currentUser.subscriptionStatus !== "trial") return;

  const trialEnd = new Date(
    currentUser.trial_end || Date.now() + 7 * 24 * 60 * 60 * 1000
  );
  const now = new Date();
  const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

  const trialInfo = document.getElementById("settings-trial-subscription-info");
  if (trialInfo) {
    if (daysLeft > 0) {
      trialInfo.textContent = `Trial expires in ${daysLeft} day${
        daysLeft !== 1 ? "s" : ""
      }`;
    } else {
      trialInfo.textContent = "Trial expired";
    }
  }
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

  // Sign out button
  if (signOutBtn) {
    signOutBtn.addEventListener("click", handleSignOut);
  }

  // File upload handlers
  setupFileUpload();
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
        showUploadStatus(
          "Your trial has expired. Please upgrade to continue.",
          "error"
        );
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
  checkAuth();
  initializeEventListeners();
});
