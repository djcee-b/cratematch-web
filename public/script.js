// Global state
let currentUser = null;
let authToken = null;
let uploadedDatabase = null;
let currentDatabaseFileName = null;
let tokenRefreshInterval = null;

// DOM elements - will be initialized after DOM loads
let loadingOverlay,
  userInfo,
  userEmail,
  subscriptionStatus,
  upgradeBtnHeader,
  settingsBtn,
  signOutBtn,
  databaseDate;
let upgradeBanner, upgradeBtnBanner;
let databaseStatusBar, statusText, statusDot;
let uploadArea, uploadBtn, databaseFile, uploadStatus, uploadMessage;
let playlistUrl, processBtn;
let resultsSection,
  resultsSummary,
  resultsDetails,
  downloadSection,
  downloadBtn,
  newPlaylistBtn;

let processingOverlay,
  errorModal,
  errorMessage,
  errorClose,
  errorOk,
  errorUpgradeBtn;
let subscriptionModal, subscriptionClose;
let trialExpirationModal, trialUpgradeBtn, trialFreeBtn, trialRemindBtn;

// Initialize DOM elements
function initializeDOMElements() {
  // Main elements
  loadingOverlay = document.getElementById("loading-overlay");
  headerNav = document.getElementById("header-nav");
  trialBanner = document.getElementById("trial-banner");
  trialCountdown = document.getElementById("trial-countdown");
  upgradeBtnBanner = document.getElementById("upgrade-btn-banner");
  signOutBtn = document.getElementById("sign-out-btn");
  databaseDate = document.getElementById("database-date");

  // Upgrade elements
  upgradeBanner = document.getElementById("upgrade-banner");
  upgradeBtnBanner = document.getElementById("upgrade-btn-banner");

  // Database status bar elements
  databaseStatusBar = document.getElementById("database-status-bar");
  statusText = document.querySelector(".status-text");
  statusDot = document.querySelector(".status-dot");

  // Upload elements
  uploadArea = document.getElementById("upload-area");
  uploadBtn = document.getElementById("upload-btn");
  databaseFile = document.getElementById("databaseFile");
  uploadStatus = document.getElementById("upload-status");
  uploadMessage = document.getElementById("upload-message");

  // Form elements
  playlistUrl = document.getElementById("playlist-url");
  processBtn = document.getElementById("process-btn");

  // Results elements
  resultsSection = document.getElementById("results-section");
  resultsSummary = document.getElementById("results-summary");
  resultsDetails = document.getElementById("results-lists"); // Changed to match actual HTML
  downloadSection = document.getElementById("download-section");
  downloadBtn = document.getElementById("download-btn");
  newPlaylistBtn = document.getElementById("import-another-btn");

  // Modal elements
  processingOverlay = document.getElementById("processing-overlay");
  errorModal = document.getElementById("error-modal");
  errorMessage = document.getElementById("error-message");
  errorClose = document.getElementById("error-close");
  errorOk = document.getElementById("error-ok");
  errorUpgradeBtn = document.getElementById("error-upgrade-btn");
  subscriptionModal = document.getElementById("subscription-modal");
  subscriptionClose = document.getElementById("subscription-close");

  // Trial expiration modal elements
  trialExpirationModal = document.getElementById("trial-expiration-modal");
  trialUpgradeBtn = document.getElementById("trial-upgrade-btn");
  trialFreeBtn = document.getElementById("trial-free-btn");
  trialRemindBtn = document.getElementById("trial-remind-btn");

  // Header subscription badge and upgrade button
  headerSubscriptionBadge = document.getElementById(
    "header-subscription-badge"
  );
  headerUpgradeBtn = document.getElementById("header-upgrade-btn");
}

// Setup event listeners
function setupEventListeners() {
  // Threshold is hardcoded to 80% internally
  const hardcodedThreshold = 80;

  // Enable process button when URL is entered
  if (playlistUrl) {
    playlistUrl.addEventListener("input", () => {
      if (processBtn) {
        processBtn.disabled = !playlistUrl.value.trim() || !uploadedDatabase;
      }
    });
  }

  // Process playlist
  if (processBtn) {
    processBtn.addEventListener("click", processPlaylist);
  }

  // New playlist button
  if (newPlaylistBtn) {
    newPlaylistBtn.addEventListener("click", () => {
      // Simply refresh the page to reset everything completely
      window.location.reload();
    });
  }

  // Handle trial banner upgrade button
  if (upgradeBtnBanner) {
    upgradeBtnBanner.addEventListener("click", () => {
      window.location.href = "/pricing.html";
    });
  }

  // Handle sign out
  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      try {
        await fetch("/auth/signout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
      } catch (error) {
        console.error("Sign out error:", error);
      } finally {
        // Clear intervals and local storage
        if (tokenRefreshInterval) {
          clearInterval(tokenRefreshInterval);
        }
        if (countdownInterval) {
          clearInterval(countdownInterval);
        }
        localStorage.removeItem("authToken");
        window.location.href = "/auth.html";
      }
    });
  }

  // Handle upgrade button
  if (upgradeBtnHeader) {
    upgradeBtnHeader.addEventListener("click", () => {
      window.location.href = "/pricing.html";
    });
  }

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
          showError("Failed to switch to free user. Please try again.");
        }
      } catch (error) {
        console.error("Error downgrading to free user:", error);
        showError("Failed to switch to free user. Please try again.");
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

  // Header upgrade button event listener
  if (headerUpgradeBtn) {
    headerUpgradeBtn.addEventListener("click", () => {
      window.location.href = "/pricing.html";
    });
  }

  // Error modal buttons
  if (errorClose) {
    errorClose.addEventListener("click", () => {
      if (errorModal) errorModal.style.display = "none";
    });
  }

  if (errorOk) {
    errorOk.addEventListener("click", () => {
      if (errorModal) errorModal.style.display = "none";
    });
  }

  if (errorUpgradeBtn) {
    errorUpgradeBtn.addEventListener("click", () => {
      window.location.href = "/pricing.html";
    });
  }

  // Subscription modal
  if (subscriptionClose) {
    subscriptionClose.addEventListener("click", () => {
      if (subscriptionModal) subscriptionModal.style.display = "none";
    });
  }

  // Handle page visibility changes (tab switching, minimizing)
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && authToken) {
      // Page became visible again, refresh auth status
      console.log("🔄 Page became visible, refreshing auth status...");
      setTimeout(() => {
        checkAuth();
      }, 1000); // Small delay to ensure page is fully loaded
    }
  });

  // Close modals when clicking outside
  window.addEventListener("click", (e) => {
    if (errorModal && e.target === errorModal) {
      errorModal.style.display = "none";
    }
    if (subscriptionModal && e.target === subscriptionModal) {
      subscriptionModal.style.display = "none";
    }
  });
}

// Check authentication on page load
async function checkAuth() {
  const token = localStorage.getItem("authToken");
  if (!token) {
    // No token, redirect to auth page
    window.location.href = "/auth.html";
    return;
  }

  try {
    // Use the more permissive /api/auth/verify endpoint instead of /auth/me
    const response = await fetch("/api/auth/verify", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;
      authToken = token;

      updateUserInterface(data);

      // Start token refresh mechanism
      startTokenRefresh();

      // Start heartbeat mechanism
      startHeartbeat();

      // Check if user has uploaded a database
      const hasDatabase = await checkUserDatabase();
      if (!hasDatabase) {
        // Redirect to onboarding if no database uploaded
        window.location.href = "/onboarding.html";
        return;
      }

      loadUserDatabases();

      // Hide loading overlay after successful auth
      hideLoadingOverlay();
    } else if (response.status === 403) {
      // Handle trial expiration gracefully
      try {
        const errorData = await response.json();
        if (errorData.trialExpired) {
          // Show trial expiration modal instead of logging out
          showTrialExpirationModal();
          // Still load the interface so user can see the modal
          const data = await fetch("/api/auth/verify", {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => (r.ok ? r.json() : null));

          if (data) {
            currentUser = data.user;
            authToken = token;
            updateUserInterface(data);
            hideLoadingOverlay();
          }
          return;
        }
      } catch (parseError) {
        console.error("Error parsing 403 response:", parseError);
      }

      // Other 403 errors - redirect to auth
      localStorage.removeItem("authToken");
      window.location.href = "/auth.html";
    } else {
      // Other errors - redirect to auth page
      localStorage.removeItem("authToken");
      window.location.href = "/auth.html";
    }
  } catch (error) {
    console.error("Auth check error:", error);
    // Only logout on network errors, not auth errors
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      // Network error - don't logout, just show error
      console.log("Network error during auth check, retrying...");
      setTimeout(checkAuth, 5000); // Retry in 5 seconds
      return;
    }
    localStorage.removeItem("authToken");
    window.location.href = "/auth.html";
  }
}

// Hide loading overlay with smooth transition
function hideLoadingOverlay() {
  if (loadingOverlay) {
    loadingOverlay.classList.add("hidden");
    setTimeout(() => {
      loadingOverlay.style.display = "none";
    }, 300);
  }
}

// Check if user has uploaded a database
async function checkUserDatabase() {
  try {
    const response = await fetch("/databases", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.databases && data.databases.length > 0;
    }
    return false;
  } catch (error) {
    console.error("Database check error:", error);
    return false;
  }
}

// Update user interface with user data
function updateUserInterface(data) {
  const status = data.subscriptionStatus || "trial";

  // Update header subscription badge and upgrade button
  if (headerSubscriptionBadge) {
    headerSubscriptionBadge.textContent = status.toUpperCase();
    headerSubscriptionBadge.className = `subscription-badge ${status}`;
    headerSubscriptionBadge.style.display = "inline-block";
  }

  // Show upgrade button for free users
  if (headerUpgradeBtn) {
    if (status === "free") {
      headerUpgradeBtn.style.display = "inline-block";
    } else {
      headerUpgradeBtn.style.display = "none";
    }
  }

  switch (status) {
    case "trial":
      // Show trial banner and countdown for trial users
      if (trialBanner) {
        trialBanner.style.display = "block";
      }
      // Start countdown timer for trial users
      const trialEndDate =
        data.machine?.trial_end ||
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      startTrialCountdown(trialEndDate);
      break;
    case "premium":
      // Hide trial banner for premium users
      if (trialBanner) {
        trialBanner.style.display = "none";
      }
      break;
    case "free":
      // Hide trial banner for free users
      if (trialBanner) {
        trialBanner.style.display = "none";
      }

      break;
    default:
      // Hide trial banner for default users
      if (trialBanner) {
        trialBanner.style.display = "none";
      }
  }

  // Show header navigation
  if (headerNav) {
    headerNav.style.display = "flex";
  }

  // Setup settings button after user info is shown
  setupSettingsButton();
}

// Token refresh mechanism to prevent token expiration
function startTokenRefresh() {
  // Clear any existing interval
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
  }

  // Refresh token every 45 minutes (tokens typically expire in 1 hour)
  tokenRefreshInterval = setInterval(async () => {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        clearInterval(tokenRefreshInterval);
        return;
      }

      // Call the verify endpoint to refresh the session
      const response = await fetch("/api/auth/verify", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Update current user data
        currentUser = data.user;
        console.log("✅ Token refreshed successfully");
      } else {
        console.warn("⚠️ Token refresh failed, will retry on next interval");
      }
    } catch (error) {
      console.error("❌ Token refresh error:", error);
      // Don't logout on refresh errors, just log them
    }
  }, 45 * 60 * 1000); // 45 minutes

  console.log("🔄 Token refresh mechanism started");
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

// Trial countdown timer
let countdownInterval = null;

function startTrialCountdown(trialEndDate) {
  // Clear any existing countdown
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  // Use the existing countdown element in the trial banner
  let countdownElement = document.getElementById("trial-countdown");
  if (!countdownElement) {
    return;
  }

  // Update countdown immediately
  updateTrialCountdown(trialEndDate, countdownElement);

  // Update countdown every second
  countdownInterval = setInterval(() => {
    updateTrialCountdown(trialEndDate, countdownElement);
  }, 1000);
}

function updateTrialCountdown(trialEndDate, countdownElement) {
  if (!trialEndDate || !countdownElement) {
    return;
  }

  const now = new Date();
  const trialEnd = new Date(trialEndDate);
  const timeLeft = trialEnd - now;

  if (timeLeft <= 0) {
    // Trial has expired
    countdownElement.textContent = "Expired";
    countdownElement.className = "trial-countdown expired";
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
    return;
  }

  // Calculate days, hours, minutes, seconds
  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  // Format countdown text
  let countdownText = "";
  if (days > 0) {
    countdownText = `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    countdownText = `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    countdownText = `${minutes}m ${seconds}s`;
  } else {
    countdownText = `${seconds}s`;
  }

  countdownElement.textContent = countdownText;

  // Add urgency styling for last 24 hours
  if (timeLeft < 24 * 60 * 60 * 1000) {
    countdownElement.className = "trial-countdown urgent";
  } else {
    countdownElement.className = "trial-countdown";
  }
}

// Load user's uploaded databases
async function loadUserDatabases() {
  // Show loading state
  showDatabaseStatus("loading", "Loading database...");

  try {
    const response = await fetch("/databases", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.databases && data.databases.length > 0) {
        // Use the most recent database
        const latestDatabase = data.databases[data.databases.length - 1];
        currentDatabaseFileName = latestDatabase.name;
        uploadedDatabase = true;

        // Update database date
        if (latestDatabase.created_at) {
          const date = new Date(latestDatabase.created_at);
          if (databaseDate) {
            databaseDate.textContent =
              date.toLocaleDateString() + " " + date.toLocaleTimeString();
          }
        } else {
          if (databaseDate) {
            databaseDate.textContent = "Recently";
          }
        }

        if (processBtn) {
          processBtn.disabled = false;
        }

        // Show loaded state
        showDatabaseStatus("loaded", "Database Ready");
      } else {
        // No database found - redirect to onboarding
        window.location.href = "/onboarding";
      }
    } else {
      console.error("Failed to load database:", response.statusText);
      // Redirect to onboarding if there's an issue
      window.location.href = "/onboarding";
    }
  } catch (error) {
    console.error("Error loading databases:", error);
    // Redirect to onboarding if there's an error
    window.location.href = "/onboarding";
  }
}

// Function to show database status
function showDatabaseStatus(status, message) {
  if (databaseStatusBar) {
    databaseStatusBar.style.display = "block";
  }
  if (statusText) {
    statusText.textContent = message;
  }

  if (status === "loading") {
    if (statusDot) {
      statusDot.className = "status-dot loading";
    }
    if (statusText) {
      statusText.className = "status-text loading";
    }
  } else if (status === "loaded") {
    if (statusDot) {
      statusDot.className = "status-dot";
    }
    if (statusText) {
      statusText.className = "status-text";
    }
  }
}

// File upload handling (removed from main page - now in settings)

// File upload handling moved to settings modal

function isValidDatabaseFile(file) {
  return true; // Accept any file, let MLT.js validate
}

function updateUploadStatus(message, type) {
  if (uploadMessage) {
    uploadMessage.textContent = message;
    uploadMessage.className = `status-message ${type}`;
  }
  if (uploadStatus) {
    uploadStatus.style.display = "block";
  }
}

function updateThresholdExample(value) {
  const examplePercent = document.getElementById("examplePercent");
  const exampleTrack = document.getElementById("exampleTrack");
  const exampleExplanation = document.getElementById("exampleExplanation");

  if (examplePercent) examplePercent.textContent = value;

  if (exampleTrack && exampleExplanation) {
    if (value <= 80) {
      exampleTrack.textContent =
        "No No No Pt 2 - destinys child → No No No Part 2 - destinys child";
      exampleExplanation.textContent =
        'Larger difference: "Pt 2" vs "Part 2". Numbers written as words or abbreviations are still matched at this threshold.';
    } else if (value <= 90) {
      exampleTrack.textContent =
        "Doo Wop - ms lauryn hill → Doo Wop - lauryn hill";
      exampleExplanation.textContent =
        'Minor difference: The spotify track has "ms" before the artist, but the Serato Version does not. Small missing words are allowed.';
    } else {
      exampleTrack.textContent = "Crew Love - Drake → Crew Love - Drake";
      exampleExplanation.textContent =
        "EXACT MATCH: This is considered a perfect match.";
    }
  }
}

async function processPlaylist() {
  if (!playlistUrl) {
    showError("Form elements not found");
    return;
  }

  const url = playlistUrl.value.trim();
  const thresholdValue = 80; // Hardcoded threshold

  if (!url) {
    showError("Please enter a Spotify playlist URL");
    return;
  }

  if (!uploadedDatabase) {
    showError("Database not found. Please check your settings.");
    return;
  }

  if (!currentDatabaseFileName) {
    showError("No database selected");
    return;
  }

  try {
    // Hide process button and show processing overlay
    if (processBtn) {
      processBtn.style.display = "none";
    }

    // Show the processing overlay
    if (processingOverlay) {
      processingOverlay.style.display = "flex";
    }

    // Show progress container and reset progress
    const progressContainer = document.getElementById("progress-container");
    const progressFill = document.getElementById("progress-fill");
    const progressStatus = document.getElementById("progress-status");
    const progressPercentage = document.getElementById("progress-percentage");

    if (progressContainer) {
      progressContainer.style.display = "block";
    }

    // Reset progress to 0
    if (progressFill) {
      progressFill.style.width = "0%";
    }

    if (progressStatus) {
      progressStatus.textContent = "Initializing...";
    }

    if (progressPercentage) {
      progressPercentage.textContent = "0%";
    }

    // Create EventSource for progress updates with auth token in URL
    const eventSourceUrl = `/process-playlist-progress?playlistUrl=${encodeURIComponent(
      url
    )}&threshold=${thresholdValue}&databaseFileName=${encodeURIComponent(
      currentDatabaseFileName
    )}&token=${encodeURIComponent(authToken)}`;

    console.log("Creating EventSource with URL:", eventSourceUrl);
    const eventSource = new EventSource(eventSourceUrl);

    eventSource.onopen = function () {
      console.log("EventSource connection opened");
    };

    eventSource.onmessage = async function (event) {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "progress") {
          const percentage = Math.round(data.progress);
          const progressFill = document.getElementById("progress-fill");
          const progressStatus = document.getElementById("progress-status");
          const progressPercentage = document.getElementById(
            "progress-percentage"
          );

          if (progressFill) {
            progressFill.style.width = `${percentage}%`;
          }

          if (progressStatus) {
            // Use the server message if provided, otherwise create a descriptive message
            let statusMessage = data.message;
            if (!statusMessage) {
              if (percentage < 30) {
                statusMessage = `Fetching tracks from Spotify... ${percentage}%`;
              } else if (percentage < 80) {
                statusMessage = `Matching tracks with your library... ${percentage}%`;
              } else {
                statusMessage = `Finalizing results... ${percentage}%`;
              }
            }
            progressStatus.textContent = statusMessage;
          }

          if (progressPercentage) {
            progressPercentage.textContent = `${percentage}%`;
          }
        } else if (data.type === "complete") {
          console.log("Processing complete:", data);
          eventSource.close();
          // Hide processing overlay
          if (processingOverlay) {
            processingOverlay.style.display = "none";
          }
          console.log("Calling showResults with:", {
            results: data.results,
            crateFile: data.crateFile,
            downloadUrl: data.downloadUrl,
            hasCrateFile: data.hasCrateFile,
          });
          await showResults(
            data.results,
            data.crateFile,
            data.downloadUrl,
            data.hasCrateFile
          );
        } else if (data.type === "error") {
          console.error("Processing error:", data);
          eventSource.close();

          // Check if this is the 50+ tracks error for free users
          if (
            data.message &&
            data.message.includes("more than 50 tracks") &&
            data.message.includes("Free users are limited")
          ) {
            console.log(
              "🔄 50+ tracks error detected, showing enhanced error..."
            );

            // Hide processing overlay immediately
            if (processingOverlay) {
              processingOverlay.style.display = "none";
            }

            // Show enhanced error with countdown and better styling
            showEnhancedError(
              data.message || "Processing failed",
              data.showUpgrade,
              () => {
                console.log("🔄 Resetting page after user acknowledgment...");
                window.location.reload();
              }
            );
          } else {
            // Handle other errors normally
            showError(data.message || "Processing failed", data.showUpgrade);
            // Hide processing overlay
            if (processingOverlay) {
              processingOverlay.style.display = "none";
            }
            if (processBtn) {
              processBtn.style.display = "block";
            }
          }
        }
      } catch (error) {
        console.error("Error parsing EventSource data:", error, event.data);
      }
    };

    eventSource.onerror = function (error) {
      console.error("EventSource error:", error);
      eventSource.close();

      // Check if it's an auth error (401/403)
      if (
        error &&
        error.target &&
        error.target.readyState === EventSource.CLOSED
      ) {
        // Try to handle auth errors gracefully
        console.log("🔄 EventSource closed, checking auth status...");
        setTimeout(async () => {
          try {
            const response = await fetch("/api/auth/verify", {
              headers: { Authorization: `Bearer ${authToken}` },
            });
            if (!response.ok) {
              // Auth failed, show error but don't logout immediately
              showError(
                "Authentication issue. Please refresh the page and try again."
              );
            } else {
              // Auth is fine, show generic error
              showError("Connection lost. Please try again.");
            }
          } catch (authError) {
            console.error("Auth check failed:", authError);
            showError("Connection lost. Please try again.");
          }
        }, 1000);
      } else {
        showError("Connection lost. Please try again.");
      }

      // Hide processing overlay
      if (processingOverlay) {
        processingOverlay.style.display = "none";
      }
      if (processBtn) {
        processBtn.style.display = "block";
      }
    };
  } catch (error) {
    console.error("Processing error:", error);
    showError("Processing failed. Please try again.");
    // Hide processing overlay
    if (processingOverlay) {
      processingOverlay.style.display = "none";
    }
    if (processBtn) {
      processBtn.style.display = "block";
    }
  }
}

async function showResults(results, crateFile, downloadUrl, hasCrateFile) {
  console.log("showResults called with:", {
    results,
    crateFile,
    downloadUrl,
    hasCrateFile,
  });

  // Debug: Log the full results structure
  console.log("Full results object:", JSON.stringify(results, null, 2));
  console.log("Results keys:", Object.keys(results));

  // Check for track lists in different possible locations
  if (results.tracks) {
    console.log("Found 'tracks' array:", results.tracks);
  }
  if (results.foundTracksList) {
    console.log("Found 'foundTracksList' array:", results.foundTracksList);
  }
  if (results.missingTracksList) {
    console.log("Found 'missingTracksList' array:", results.missingTracksList);
  }
  if (results.foundTracks) {
    console.log("Found 'foundTracks' array:", results.foundTracks);
  }
  if (results.missingTracks) {
    console.log("Found 'missingTracks' array:", results.missingTracks);
  }

  // Hide the input section and show results
  const inputSection = document.getElementById("input-section");
  if (inputSection) {
    inputSection.style.display = "none";
  }
  if (resultsSection) {
    resultsSection.style.display = "block";
  }

  // Hide progress bar
  const progressContainer = document.getElementById("progress-container");
  if (progressContainer) {
    progressContainer.style.display = "none";
  }

  // Hide any open modals
  const trackModal = document.getElementById("track-modal");
  if (trackModal) {
    trackModal.style.display = "none";
  }

  const errorModal = document.getElementById("error-modal");
  if (errorModal) {
    errorModal.style.display = "none";
  }

  // Update summary
  let summaryText = "";
  if (hasCrateFile && results.foundTracks && results.foundTracks > 0) {
    summaryText = `Crate is ready! Found ${results.foundTracks} tracks in your library.`;
  } else if (results.foundTracks && results.foundTracks > 0) {
    summaryText = `Processing complete! Found ${results.foundTracks} tracks in your library.`;
  } else {
    summaryText = "No matching tracks found in your Serato library.";
  }

  if (resultsSummary) {
    resultsSummary.textContent = summaryText;
  }

  // Show/hide download button
  console.log(
    "hasCrateFile:",
    hasCrateFile,
    "crateFile:",
    crateFile,
    "downloadUrl:",
    downloadUrl
  );

  if (hasCrateFile && crateFile) {
    if (downloadSection) {
      downloadSection.style.display = "block";
    }
    if (downloadBtn) {
      downloadBtn.onclick = async () => {
        if (downloadUrl) {
          try {
            // Make authenticated download request
            const response = await fetch(downloadUrl, {
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
            });

            if (response.ok) {
              // Create blob and download
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = crateFile || "crate.crate";
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            } else {
              console.error("Download failed:", response.statusText);
              showError("Download failed. Please try again.");
            }
          } catch (error) {
            console.error("Download error:", error);
            showError("Download failed. Please try again.");
          }
        }
      };
    }
  } else {
    if (downloadSection) {
      downloadSection.style.display = "none";
    }
  }

  // Update the toggle buttons with counts
  const foundTracksToggle = document.getElementById("found-tracks-toggle");
  const missingTracksToggle = document.getElementById("missing-tracks-toggle");
  const foundTracksCount = document.getElementById("found-tracks-count");
  const missingTracksCount = document.getElementById("missing-tracks-count");

  if (results.foundTracks && results.foundTracks > 0) {
    // Update toggle button counts
    if (foundTracksCount) {
      foundTracksCount.textContent = results.foundTracks;
    }
    if (missingTracksCount) {
      const missingCount = (results.totalTracks || 0) - results.foundTracks;
      missingTracksCount.textContent = missingCount;
    }

    // Store results data for popup
    window.resultsData = results;
    console.log("Stored results data for modal:", {
      foundTracks: results.foundTracks,
      foundTracksList: results.foundTracksList?.length,
      missingTracks: results.missingTracks,
      missingTracksList: results.missingTracksList?.length,
      totalTracks: results.totalTracks,
    });

    // Setup click handlers for the toggle buttons
    if (foundTracksToggle) {
      foundTracksToggle.onclick = () => {
        showTrackDetailsModal("found");
      };
    }
    if (missingTracksToggle) {
      missingTracksToggle.onclick = () => {
        showTrackDetailsModal("missing");
      };
    }
  } else {
    // No tracks found
    if (foundTracksCount) {
      foundTracksCount.textContent = "0";
    }
    if (missingTracksCount) {
      missingTracksCount.textContent = "0";
    }
  }

  // Scroll to results
  if (resultsSection) {
    resultsSection.scrollIntoView({ behavior: "smooth" });
  }

  // Save scan history to Supabase
  const playlistUrl = document.getElementById("playlist-url")?.value || "";
  const foundCount = results.foundTracks || 0;
  const missingCount = results.missingTracks || 0;
  const totalCount = foundCount + missingCount;

  // Try to get playlist name from results or use a default
  const playlistName =
    results.playlistName || results.playlist_name || "Playlist";

  // Save the complete results as JSON
  console.log("💾 Saving scan history to database...");
  console.log("📊 Scan data:", {
    playlistUrl,
    playlistName,
    foundCount,
    missingCount,
    totalCount,
    resultsKeys: Object.keys(results || {}),
    hasFoundTracks: !!(results && results.foundTracksList),
    hasMissingTracks: !!(results && results.missingTracksList),
  });

  saveScanHistory(
    playlistUrl,
    playlistName,
    foundCount,
    missingCount,
    totalCount,
    results
  )
    .then(() => {
      console.log("✅ Scan history saved successfully!");
    })
    .catch((error) => {
      console.log("Failed to save scan history:", error.message);
    });
}

function generateTrackTable(tracks, type) {
  console.log(`Generating ${type} table with tracks:`, tracks);

  if (!tracks || tracks.length === 0) {
    return `<div class="no-tracks">No ${type} tracks to display.</div>`;
  }

  // Sort tracks by percentage (highest first)
  const sortedTracks = tracks.sort((a, b) => {
    const aPercentage =
      a.similarityScore ||
      a.matchPercentage ||
      a.percentage ||
      a.matchPercent ||
      a.score ||
      a.similarity ||
      0;
    const bPercentage =
      b.similarityScore ||
      b.matchPercentage ||
      b.percentage ||
      b.matchPercent ||
      b.score ||
      b.similarity ||
      0;
    return bPercentage - aPercentage; // Sort descending (highest first)
  });

  const tableRows = sortedTracks
    .map((track, index) => {
      console.log(`Processing track ${index}:`, track);
      console.log(`Track keys:`, Object.keys(track));

      // Try different possible property names for the data
      let matchPercentage =
        track.similarityScore ||
        track.matchPercentage ||
        track.percentage ||
        track.matchPercent ||
        track.score ||
        track.similarity ||
        null;

      // For missing tracks, if similarity is null, show "-" instead of "N/A"
      if (
        type === "missing" &&
        (matchPercentage === null ||
          matchPercentage === undefined ||
          matchPercentage === "N/A")
      ) {
        matchPercentage = "-";
      } else if (matchPercentage === null || matchPercentage === undefined) {
        matchPercentage = "N/A";
      }
      const spotifyTrack =
        track.name ||
        track.title ||
        track.spotifyTrack ||
        track.spotify ||
        track.trackName ||
        track.spotify_name ||
        track.spotifyName ||
        "Unknown";
      let seratoTrack = "Not found";
      let variationsPopup = "";

      if (type === "found" && track.versions && track.versions.length > 0) {
        // Debug: Log the first track's data
        if (index === 0) {
          console.log("First track data:", track);
          console.log("First version data:", track.versions[0]);
        }

        if (track.versions.length === 1) {
          seratoTrack = {
            title:
              track.versions[0].originalSeratoTitle ||
              track.versions[0].title ||
              "Unknown Title",
            artist:
              track.versions[0].originalSeratoArtist ||
              track.versions[0].artist ||
              "Unknown Artist",
          };
        } else {
          // Show first variation with popup for others
          seratoTrack = {
            title:
              track.versions[0].originalSeratoTitle ||
              track.versions[0].title ||
              "Unknown Title",
            artist:
              track.versions[0].originalSeratoArtist ||
              track.versions[0].artist ||
              "Unknown Artist",
          };
          variationsPopup = `
                <div class="variations-popup">
                  <div class="variations-popup-title">All ${
                    track.versions.length
                  } versions found:</div>
                  ${track.versions
                    .map(
                      (v) =>
                        `<div class="variations-popup-item">${
                          v.originalSeratoTitle || v.title || "Unknown Title"
                        } - ${
                          v.originalSeratoArtist || v.artist || "Unknown Artist"
                        }</div>`
                    )
                    .join("")}
                </div>
              `;
        }
      } else if (type === "missing") {
        seratoTrack = "Not found in library";
      }
      const artist = (
        track.artist ||
        track.spotifyArtist ||
        track.spotify_artist ||
        track.trackArtist ||
        track.spotify_artist_name ||
        track.spotifyArtistName ||
        "Unknown"
      ).replace(/\b\w/g, (l) => l.toUpperCase());
      const album =
        track.album ||
        track.spotifyAlbum ||
        track.spotify_album ||
        track.trackAlbum ||
        track.spotify_album_name ||
        track.spotifyAlbumName ||
        track.playlistName ||
        track.source ||
        "No album info";

      return `
            <tr class="track-row ${
              type === "found" ? "status-found" : "status-missing"
            }">
              <td class="track-number">${index + 1}</td>
              <td class="track-info">
                <div class="track-name">${spotifyTrack}</div>
                <div class="track-artist">${artist}</div>
                ${
                  album !== "No album info"
                    ? `<div class="track-album">${album}</div>`
                    : ""
                }
              </td>
              <td class="track-match">
                ${
                  typeof seratoTrack === "object"
                    ? `<div class="track-name">${seratoTrack.title}</div><div class="track-artist">${seratoTrack.artist}</div>`
                    : seratoTrack
                }
              </td>
              <td class="track-percentage">
                <span class="percentage-badge ${getPercentageClass(
                  matchPercentage
                )}">
                  ${matchPercentage === "-" ? "-" : `${matchPercentage}%`}
                </span>
              </td>
              <td class="track-variations status-cell">
                ${
                  type === "found" &&
                  track.versions &&
                  track.versions.length > 0
                    ? track.versions
                        .map(
                          (v) =>
                            `${
                              v.originalSeratoTitle ||
                              v.title ||
                              "Unknown Title"
                            } - ${
                              v.originalSeratoArtist ||
                              v.artist ||
                              "Unknown Artist"
                            }`
                        )
                        .join("<br>")
                    : "<span class='no-variations'>-</span>"
                }
              </td>
            </tr>
          `;
    })
    .join("");

  return `
    <div class="table-wrapper">
      ${
        type === "missing" && tracks.length > 0
          ? `
        <div class="text-list-button-container">
          <button class="text-list-button" onclick="showTextList('${type}')">
            📋 Show Text List (${tracks.length} tracks)
          </button>
        </div>
      `
          : ""
      }
      <table class="tracks-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Spotify Track</th>
            <th>Serato Match</th>
            <th>Match %</th>
            <th>Variations</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
  `;
}

function getPercentageClass(percentage) {
  if (percentage === "N/A" || percentage === "-") return "percentage-na";
  const num = parseInt(percentage);
  if (num >= 95) return "percentage-excellent";
  if (num >= 85) return "percentage-good";
  if (num >= 75) return "percentage-fair";
  return "percentage-poor";
}

function showTrackDetailsModal(type) {
  console.log("showTrackDetailsModal called with type:", type);

  const modal = document.getElementById("track-modal");
  const title = document.getElementById("track-modal-title");
  const tableBody = document.getElementById("track-table-body");
  const listView = document.getElementById("track-list-view");
  const tableView = document.getElementById("track-table-view");

  if (!window.resultsData) {
    console.error("No results data available");
    return;
  }

  const results = window.resultsData;
  console.log("Results data in modal:", results);

  // Update title
  if (title) {
    title.textContent = type === "found" ? "Found Tracks" : "Missing Tracks";
  }

  // Generate table content
  console.log("Looking for track data in results:", results);

  // Try different possible data structures
  let foundTracks = [];
  let missingTracks = [];

  if (
    results.foundTracksDetailed &&
    Array.isArray(results.foundTracksDetailed)
  ) {
    foundTracks = results.foundTracksDetailed;
    console.log("Using foundTracksDetailed:", foundTracks);
  } else if (
    results.foundTracksList &&
    Array.isArray(results.foundTracksList)
  ) {
    foundTracks = results.foundTracksList;
    console.log("Using foundTracksList:", foundTracks);
  } else if (results.foundTracks && Array.isArray(results.foundTracks)) {
    foundTracks = results.foundTracks;
    console.log("Using foundTracks array:", foundTracks);
  } else if (results.tracks && Array.isArray(results.tracks)) {
    foundTracks = results.tracks.filter(
      (t) => t.found || t.matched || t.status === "found"
    );
    missingTracks = results.tracks.filter(
      (t) => !t.found && !t.matched && t.status !== "found"
    );
    console.log(
      "Using tracks array - found:",
      foundTracks,
      "missing:",
      missingTracks
    );
  } else if (results.matchedTracks && Array.isArray(results.matchedTracks)) {
    foundTracks = results.matchedTracks;
    console.log("Using matchedTracks:", foundTracks);
  } else if (
    results.unmatchedTracks &&
    Array.isArray(results.unmatchedTracks)
  ) {
    missingTracks = results.unmatchedTracks;
    console.log("Using unmatchedTracks:", missingTracks);
  }

  if (
    results.missingTracksDetailed &&
    Array.isArray(results.missingTracksDetailed)
  ) {
    missingTracks = results.missingTracksDetailed;
    console.log("Using missingTracksDetailed:", missingTracks);
  } else if (
    results.missingTracksList &&
    Array.isArray(results.missingTracksList)
  ) {
    missingTracks = results.missingTracksList;
    console.log("Using missingTracksList:", missingTracks);
  }

  // If we still don't have data, try to extract from other properties
  if (foundTracks.length === 0 && missingTracks.length === 0) {
    console.log("No standard track arrays found, checking other properties...");
    console.log("All results keys:", Object.keys(results));

    // Look for any array properties that might contain track data
    for (const [key, value] of Object.entries(results)) {
      if (Array.isArray(value) && value.length > 0) {
        console.log(`Found array property '${key}':`, value);
        if (
          key.toLowerCase().includes("found") ||
          key.toLowerCase().includes("matched")
        ) {
          foundTracks = value;
        } else if (
          key.toLowerCase().includes("missing") ||
          key.toLowerCase().includes("unmatched")
        ) {
          missingTracks = value;
        }
      }
    }
  }

  // Get the tracks for the selected type
  let tracks = [];
  if (type === "found") {
    tracks = foundTracks;
  } else {
    tracks = missingTracks;
  }

  // Generate table rows
  if (tableBody && tracks.length > 0) {
    const tableRows = tracks
      .map((track, index) => {
        const spotifyTrack =
          track.name ||
          track.title ||
          track.spotifyTrack ||
          track.spotify ||
          track.trackName ||
          track.spotify_name ||
          track.spotifyName ||
          "Unknown";
        const artist = (
          track.artist ||
          track.spotifyArtist ||
          track.spotify_artist ||
          track.trackArtist ||
          track.spotify_artist_name ||
          track.spotifyArtistName ||
          "Unknown"
        ).replace(/\b\w/g, (l) => l.toUpperCase());
        let matchPercentage =
          track.similarityScore ||
          track.matchPercentage ||
          track.percentage ||
          track.matchPercent ||
          track.score ||
          track.similarity ||
          null;

        // For missing tracks, if similarity is null, show "-" instead of "N/A"
        if (
          type === "missing" &&
          (matchPercentage === null ||
            matchPercentage === undefined ||
            matchPercentage === "N/A")
        ) {
          matchPercentage = "-";
        } else if (matchPercentage === null || matchPercentage === undefined) {
          matchPercentage = "N/A";
        }

        let seratoMatch = "Not found";
        if (type === "found" && track.versions && track.versions.length > 0) {
          seratoMatch = `${
            track.versions[0].originalSeratoTitle ||
            track.versions[0].title ||
            "Unknown"
          } - ${
            track.versions[0].originalSeratoArtist ||
            track.versions[0].artist ||
            "Unknown"
          }`;
        }

        // Generate variations indicator for modal
        let variationsIndicator = "";
        if (type === "found" && track.versions && track.versions.length > 1) {
          variationsIndicator = `<ul class="variations-list">${track.versions
            .map(
              (v) =>
                `<li>${v.originalSeratoTitle || v.title || "Unknown Title"} - ${
                  v.originalSeratoArtist || v.artist || "Unknown Artist"
                }</li>`
            )
            .join("")}</ul>`;
        } else {
          variationsIndicator = "<span class='no-variations'>-</span>";
        }

        return `
        <tr>
          <td>${spotifyTrack} - ${artist}</td>
          <td>${seratoMatch}</td>
          <td>${matchPercentage === "-" ? "-" : `${matchPercentage}%`}</td>
          <td class="track-variations status-cell">${variationsIndicator}</td>
        </tr>
      `;
      })
      .join("");

    tableBody.innerHTML = tableRows;
  } else if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="4">No ${type} tracks to display.</td></tr>`;
  }

  // Show modal
  if (modal) {
    modal.style.display = "flex";
    // Prevent body scrolling when modal is open
    document.body.style.overflow = "hidden";
  }

  // Setup view toggle buttons
  const tableViewBtn = document.getElementById("table-view-btn");
  const listViewBtn = document.getElementById("list-view-btn");
  const trackTableView = document.getElementById("track-table-view");
  const trackListView = document.getElementById("track-list-view");
  const trackListText = document.getElementById("track-list-text");

  if (tableViewBtn && listViewBtn) {
    // Table view button
    tableViewBtn.onclick = () => {
      tableViewBtn.classList.add("active");
      listViewBtn.classList.remove("active");
      if (trackTableView) trackTableView.style.display = "block";
      if (trackListView) trackListView.style.display = "none";
    };

    // List view button
    listViewBtn.onclick = () => {
      listViewBtn.classList.add("active");
      tableViewBtn.classList.remove("active");
      if (trackTableView) trackTableView.style.display = "none";
      if (trackListView) trackListView.style.display = "block";

      // Generate list text
      if (trackListText && tracks.length > 0) {
        const listText = tracks
          .map((track, index) => {
            const spotifyTrack =
              track.name ||
              track.title ||
              track.spotifyTrack ||
              track.spotify ||
              track.trackName ||
              track.spotify_name ||
              track.spotifyName ||
              "Unknown";
            const artist = (
              track.artist ||
              track.spotifyArtist ||
              track.spotify_artist ||
              track.trackArtist ||
              track.spotify_artist_name ||
              track.spotifyArtistName ||
              "Unknown"
            ).replace(/\b\w/g, (l) => l.toUpperCase());
            return `${spotifyTrack} - ${artist}`;
          })
          .join("<br>");
        trackListText.innerHTML = listText;
      }
    };
  }

  // Setup close button
  const closeBtn = document.getElementById("track-modal-close");
  if (closeBtn) {
    closeBtn.onclick = () => {
      if (modal) {
        modal.style.display = "none";
        // Restore body scrolling
        document.body.style.overflow = "auto";
      }
    };
  }

  // Close on overlay click
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
        // Restore body scrolling
        document.body.style.overflow = "auto";
      }
    };
  }
}

// Error handling
function showError(message, showUpgrade = false) {
  if (errorMessage) {
    errorMessage.textContent = message;
  }

  // Show/hide upgrade button based on parameter
  if (errorUpgradeBtn) {
    errorUpgradeBtn.style.display = showUpgrade ? "inline-block" : "none";
  }

  if (errorModal) {
    errorModal.style.display = "flex";
  }
}

// Enhanced error handling for 50+ tracks error with countdown and better UX
function showEnhancedError(message, showUpgrade = false, onComplete = null) {
  // Create enhanced error modal if it doesn't exist
  let enhancedErrorModal = document.getElementById("enhanced-error-modal");

  if (!enhancedErrorModal) {
    enhancedErrorModal = document.createElement("div");
    enhancedErrorModal.id = "enhanced-error-modal";
    enhancedErrorModal.className = "enhanced-error-modal";
    enhancedErrorModal.innerHTML = `
      <div class="enhanced-error-content">
        <div class="enhanced-error-header">
          <div class="enhanced-error-icon">⚠️</div>
          <h3>Playlist Too Large</h3>
          <button class="enhanced-error-close" onclick="closeEnhancedError()">×</button>
        </div>
        <div class="enhanced-error-body">
          <p class="enhanced-error-message"></p>
          <div class="enhanced-error-countdown">
            <div class="countdown-text">Page will reset in <span class="countdown-number">5</span> seconds</div>
            <div class="countdown-progress">
              <div class="countdown-progress-fill"></div>
            </div>
          </div>
          <div class="enhanced-error-actions">
            <button class="enhanced-error-reset-now" onclick="resetPageNow()">Reset Now</button>
            <button class="enhanced-error-upgrade" onclick="window.location.href='/pricing.html'" style="display: none;">
              Upgrade to Premium
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(enhancedErrorModal);
  }

  // Update message
  const messageElement = enhancedErrorModal.querySelector(
    ".enhanced-error-message"
  );
  if (messageElement) {
    messageElement.textContent = message;
  }

  // Show/hide upgrade button
  const upgradeBtn = enhancedErrorModal.querySelector(
    ".enhanced-error-upgrade"
  );
  if (upgradeBtn) {
    upgradeBtn.style.display = showUpgrade ? "inline-block" : "none";
  }

  // Show modal
  enhancedErrorModal.style.display = "flex";
  document.body.style.overflow = "hidden";

  // Start countdown
  let countdown = 5;
  const countdownNumber = enhancedErrorModal.querySelector(".countdown-number");
  const countdownProgressFill = enhancedErrorModal.querySelector(
    ".countdown-progress-fill"
  );

  const countdownInterval = setInterval(() => {
    countdown--;
    if (countdownNumber) {
      countdownNumber.textContent = countdown;
    }
    if (countdownProgressFill) {
      const progress = ((5 - countdown) / 5) * 100;
      countdownProgressFill.style.width = `${progress}%`;
    }

    if (countdown <= 0) {
      clearInterval(countdownInterval);
      if (onComplete) {
        onComplete();
      }
    }
  }, 1000);

  // Store the interval and callback for manual reset
  window.enhancedErrorCountdown = {
    interval: countdownInterval,
    onComplete: onComplete,
  };
}

// Close enhanced error modal
function closeEnhancedError() {
  const modal = document.getElementById("enhanced-error-modal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
  }

  // Clear countdown
  if (window.enhancedErrorCountdown) {
    clearInterval(window.enhancedErrorCountdown.interval);
    window.enhancedErrorCountdown = null;
  }
}

// Reset page immediately
function resetPageNow() {
  if (window.enhancedErrorCountdown) {
    clearInterval(window.enhancedErrorCountdown.interval);
    if (window.enhancedErrorCountdown.onComplete) {
      window.enhancedErrorCountdown.onComplete();
    }
  }
}

// Subscription modal
function showSubscriptionModal() {
  if (subscriptionModal) {
    subscriptionModal.style.display = "flex";
  }
}

// Trial expiration modal
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

// Global error handler for trial expiration and auth issues
async function handleApiError(response) {
  if (response.status === 403) {
    try {
      const data = await response.json();
      if (data.trialExpired) {
        showTrialExpirationModal();
        return true; // Error was handled
      }
    } catch (error) {
      // If we can't parse the response, continue with normal error handling
    }
  } else if (response.status === 401) {
    // Token expired or invalid - try to refresh
    console.log("🔄 401 error detected, attempting token refresh...");
    const token = localStorage.getItem("authToken");
    if (token) {
      try {
        const refreshResponse = await fetch("/api/auth/verify", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (refreshResponse.ok) {
          console.log("✅ Token refresh successful");
          return true; // Error was handled
        }
      } catch (refreshError) {
        console.error("❌ Token refresh failed:", refreshError);
      }
    }
    // If refresh fails, redirect to auth
    localStorage.removeItem("authToken");
    window.location.href = "/auth.html";
    return true; // Error was handled
  }
  return false; // Error was not handled
}

// Settings functionality
function setupSettingsButton() {
  // Setup settings button to redirect to settings page
  if (settingsBtn) {
    // Remove any existing event listeners
    settingsBtn.removeEventListener("click", handleSettingsClick);
    // Add new event listener
    settingsBtn.addEventListener("click", handleSettingsClick);
    console.log("Settings button event listener added");
  } else {
    // Settings button doesn't exist on this page (e.g., settings page itself)
    console.log("Settings button not found on this page");
  }
}

function handleSettingsClick() {
  console.log("Settings button clicked, redirecting to settings page");
  window.location.href = "/settings.html";
}

function setupSettings() {
  // Setup settings button to redirect to settings page
  setupSettingsButton();

  // Setup settings modal elements (only if they exist)
  const settingsModal = document.getElementById("settings-modal");
  const settingsClose = document.getElementById("settings-close");
  const settingsUploadArea = document.getElementById("settings-upload-area");
  const settingsUploadBtn = document.getElementById("settings-upload-btn");
  const settingsDatabaseFile = document.getElementById("settingsDatabaseFile");
  const settingsUploadStatus = document.getElementById(
    "settings-upload-status"
  );
  const settingsUploadMessage = document.getElementById(
    "settings-upload-message"
  );

  // Only setup modal functionality if modal exists
  if (settingsModal && settingsClose) {
    settingsClose.addEventListener("click", () => {
      settingsModal.style.display = "none";
    });

    // Close modal when clicking outside
    window.addEventListener("click", (e) => {
      if (e.target === settingsModal) {
        settingsModal.style.display = "none";
      }
    });
  }

  // Only setup upload functionality if elements exist
  if (settingsUploadArea && settingsDatabaseFile && settingsUploadBtn) {
    // Settings drag and drop
    settingsUploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      settingsUploadArea.classList.add("dragover");
    });

    settingsUploadArea.addEventListener("dragleave", (e) => {
      e.preventDefault();
      settingsUploadArea.classList.remove("dragover");
    });

    settingsUploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      settingsUploadArea.classList.remove("dragover");

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleSettingsFileUpload(files[0]);
      }
    });

    settingsUploadArea.addEventListener("click", () => {
      settingsDatabaseFile.click();
    });

    settingsDatabaseFile.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        handleSettingsFileUpload(e.target.files[0]);
      }
    });

    settingsUploadBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      settingsDatabaseFile.click();
    });
  }
}

// Handle settings file upload (overwrites existing database)
async function handleSettingsFileUpload(file) {
  if (!isValidDatabaseFile(file)) {
    showSettingsUploadStatus("Please select a valid database file.", "error");
    return;
  }

  try {
    showSettingsUploadStatus("Uploading new database file...", "loading");
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
      showSettingsUploadStatus("✅ Database updated successfully!", "success");
      // Refresh the database list
      loadUserDatabases();
      // Close modal after a delay
      setTimeout(() => {
        document.getElementById("settings-modal").style.display = "none";
      }, 2000);
    } else {
      if (response.status === 403 && data.trialExpired) {
        showTrialExpirationModal();
      } else {
        showSettingsUploadStatus(
          data.message || "Upload failed. Please try again.",
          "error"
        );
      }
    }
  } catch (error) {
    console.error("Settings upload error:", error);
    showSettingsUploadStatus("Upload failed. Please try again.", "error");
  } finally {
    settingsUploadBtn.disabled = false;
  }
}

// Show settings upload status
function showSettingsUploadStatus(message, type) {
  settingsUploadMessage.textContent = message;
  settingsUploadStatus.className = `upload-status ${type}`;
  settingsUploadStatus.style.display = "block";
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Initialize DOM elements first
  initializeDOMElements();

  // Setup event listeners
  setupEventListeners();

  // Add a timeout to prevent infinite loading
  setTimeout(() => {
    if (loadingOverlay && !loadingOverlay.classList.contains("hidden")) {
      console.warn("Auth check taking too long, hiding loading overlay");
      hideLoadingOverlay();
    }
  }, 10000); // 10 second timeout

  checkAuth();

  // Setup variations popup functionality
  setupVariationsPopup();

  // Check if we should show trial expiration reminder
  if (checkTrialExpirationReminder()) {
    showTrialExpirationModal();
  }
});

// Setup variations popup functionality
function setupVariationsPopup() {
  // Use event delegation to handle variations popup
  document.addEventListener("mouseover", function (e) {
    if (e.target.classList.contains("variations-indicator")) {
      const popup = e.target.querySelector(".variations-popup");
      if (popup) {
        popup.classList.add("show");
      }
    }
  });

  document.addEventListener("mouseout", function (e) {
    if (e.target.classList.contains("variations-indicator")) {
      const popup = e.target.querySelector(".variations-popup");
      if (popup) {
        popup.classList.remove("show");
      }
    }
  });
}

// Text List Functions
function showTextList(type) {
  if (!window.resultsData) {
    console.error("No results data available");
    return;
  }

  const results = window.resultsData;
  let tracks = [];

  // Get missing tracks data
  if (type === "missing") {
    if (
      results.missingTracksDetailed &&
      Array.isArray(results.missingTracksDetailed)
    ) {
      tracks = results.missingTracksDetailed;
    } else if (
      results.missingTracksList &&
      Array.isArray(results.missingTracksList)
    ) {
      tracks = results.missingTracksList;
    } else if (
      results.unmatchedTracks &&
      Array.isArray(results.unmatchedTracks)
    ) {
      tracks = results.unmatchedTracks;
    } else if (results.tracks && Array.isArray(results.tracks)) {
      tracks = results.tracks.filter(
        (t) => !t.found && !t.matched && t.status !== "found"
      );
    }
  }

  if (tracks.length === 0) {
    console.error("No missing tracks found");
    return;
  }

  // Generate text list
  const textList = tracks
    .map((track) => {
      const trackName =
        track.name ||
        track.title ||
        track.spotifyTrack ||
        track.spotify ||
        track.trackName ||
        track.spotify_name ||
        track.spotifyName ||
        "Unknown";
      const artist = (
        track.artist ||
        track.spotifyArtist ||
        track.spotify_artist ||
        track.trackArtist ||
        track.spotify_artist_name ||
        track.spotifyArtistName ||
        "Unknown"
      ).replace(/\b\w/g, (l) => l.toUpperCase());
      return `${trackName} - ${artist}`;
    })
    .join("<br>");

  // Update modal content
  document.getElementById("text-list-tracks").innerHTML = textList;

  // Show modal
  document.getElementById("text-list-modal").classList.add("show");

  // Setup copy functionality
  document.getElementById("text-list-copy").onclick = () => {
    navigator.clipboard
      .writeText(textList)
      .then(() => {
        const copyBtn = document.getElementById("text-list-copy");
        const originalText = copyBtn.textContent;
        copyBtn.textContent = "✅ Copied!";
        copyBtn.style.background = "linear-gradient(135deg, #22c55e, #16a34a)";

        setTimeout(() => {
          copyBtn.textContent = originalText;
          copyBtn.style.background =
            "linear-gradient(135deg, #22c55e, #16a34a)";
        }, 2000);
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
        alert(
          "Failed to copy to clipboard. Please select and copy the text manually."
        );
      });
  };

  // Setup close functionality
  document.getElementById("text-list-close").onclick = () => {
    document.getElementById("text-list-modal").classList.remove("show");
  };

  // Close on outside click
  document.getElementById("text-list-modal").onclick = (e) => {
    if (e.target === document.getElementById("text-list-modal")) {
      document.getElementById("text-list-modal").classList.remove("show");
    }
  };
}

// Scan History Functions
async function loadScanHistory() {
  console.log("🔍 loadScanHistory called");
  if (!scanHistoryList) {
    console.log("❌ scanHistoryList not found");
    return;
  }

  try {
    console.log("🔍 Fetching scan history from /api/scan-history");
    const response = await fetch("/api/scan-history", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log("✅ Scan history data received:", data);
      displayScanHistory(data.scanHistory || []);
    } else if (response.status === 500) {
      // Table might not exist yet, show empty state
      console.log("Scan history table not available yet");
      displayScanHistory([]);
    } else {
      console.error("Failed to load scan history:", response.status);
    }
  } catch (error) {
    console.error("Error loading scan history:", error);
    // Show empty state on error
    displayScanHistory([]);
  }
}

function displayScanHistory(scanHistory) {
  console.log("🔍 displayScanHistory called with:", scanHistory);
  if (!scanHistoryList) {
    console.log("❌ scanHistoryList not found in displayScanHistory");
    return;
  }

  if (scanHistory.length === 0) {
    console.log("📝 Displaying empty scan history message");
    scanHistoryList.innerHTML = `
      <div class="no-scan-history">
        <p>No scan history yet. Process your first playlist to see it here!</p>
      </div>
    `;
    return;
  }

  scanHistoryList.innerHTML = scanHistory
    .map((scan) => {
      const date = new Date(scan.created_at).toLocaleDateString();
      const time = new Date(scan.created_at).toLocaleTimeString();

      return `
        <div class="scan-history-item" data-scan-id="${scan.id}">
          <div class="scan-history-item-header">
            <h4 class="scan-history-item-title">${
              scan.spotify_playlist_name || "Playlist"
            }</h4>
            <span class="scan-history-item-date">${date} at ${time}</span>
          </div>
          <a href="${
            scan.spotify_playlist_url
          }" target="_blank" class="scan-history-item-url">
            ${scan.spotify_playlist_url}
          </a>
          <div class="scan-history-item-stats">
            <div class="scan-history-stat found">
              <div class="scan-history-stat-icon found"></div>
              <span>${scan.found_tracks_count} found</span>
            </div>
            <div class="scan-history-stat missing">
              <div class="scan-history-stat-icon missing"></div>
              <span>${scan.missing_tracks_count} missing</span>
            </div>
            <div class="scan-history-stat">
              <span>${scan.total_tracks} total</span>
            </div>
          </div>
          <div class="scan-history-item-actions">
            <button class="scan-history-view-btn" data-scan-id="${scan.id}">
              View Details
            </button>
            <button class="scan-history-delete-btn" data-scan-id="${scan.id}">
              Delete
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  // Add click event listeners to scan history items
  const scanHistoryItems =
    scanHistoryList.querySelectorAll(".scan-history-item");
  scanHistoryItems.forEach((item) => {
    const viewBtn = item.querySelector(".scan-history-view-btn");
    if (viewBtn) {
      viewBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const scanId = viewBtn.getAttribute("data-scan-id");
        loadScanDetails(scanId);
      });
    }

    const deleteBtn = item.querySelector(".scan-history-delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const scanId = deleteBtn.getAttribute("data-scan-id");

        if (
          confirm(
            "Are you sure you want to delete this scan? This action cannot be undone."
          )
        ) {
          try {
            const response = await fetch(`/api/scan-history/${scanId}`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
            });

            if (response.ok) {
              console.log("✅ Scan deleted successfully:", scanId);
              loadScanHistory(); // Reload the list
            } else {
              console.error("❌ Failed to delete scan");
              showError("Failed to delete scan");
            }
          } catch (error) {
            console.error("❌ Error deleting scan:", error);
            showError("Error deleting scan");
          }
        }
      });
    }
  });
}

async function saveScanHistory(
  playlistUrl,
  playlistName,
  foundCount,
  missingCount,
  totalCount,
  results = null
) {
  try {
    const payload = {
      spotify_playlist_url: playlistUrl,
      spotify_playlist_name: playlistName,
      found_tracks_count: foundCount,
      missing_tracks_count: missingCount,
      total_tracks: totalCount,
      results: results, // Include detailed results if available
    };

    console.log("📤 Sending scan history to server...");
    console.log("📦 Payload summary:", {
      playlistUrl,
      playlistName,
      foundCount,
      missingCount,
      totalCount,
      hasResults: !!results,
      resultsSize: results ? JSON.stringify(results).length : 0,
      totalPayloadSize: JSON.stringify(payload).length,
    });

    if (results) {
      console.log("🔍 Results structure:", {
        keys: Object.keys(results),
        foundTracksCount: results.foundTracksList?.length || 0,
        missingTracksCount: results.missingTracksList?.length || 0,
        totalTracks: results.totalTracks || 0,
      });
    }

    const response = await fetch("/api/scan-history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const responseData = await response.json();
      console.log("✅ Server response:", responseData);
      // Scan history saved successfully - no need to reload since we're not displaying it on this page
    } else {
      console.error(
        "Failed to save scan history:",
        response.status,
        response.statusText
      );
    }
  } catch (error) {
    console.error("Error saving scan history:", error);
  }
}

async function loadScanDetails(scanId) {
  try {
    console.log("Loading scan details for scan ID:", scanId);

    const response = await fetch(`/api/scan-history/${scanId}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load scan details");
    }

    const data = await response.json();
    console.log("Scan details loaded:", data);
    console.log("🔍 Debug: Found tracks sample:", data.foundTracks?.[0]);
    console.log("🔍 Debug: Missing tracks sample:", data.missingTracks?.[0]);

    // Show the results section
    const resultsSection = document.getElementById("results-section");
    if (resultsSection) {
      resultsSection.style.display = "block";
    }

    // Update the results summary
    const resultsSummary = document.getElementById("results-summary");
    if (resultsSummary) {
      resultsSummary.innerHTML = `
        <div class="summary-card found">
          <div class="summary-card-icon found"></div>
          <div class="summary-card-content">
            <h4>Found Tracks</h4>
            <p>${data.foundTracks.length} tracks matched in your Serato library</p>
          </div>
        </div>
        <div class="summary-card missing">
          <div class="summary-card-icon missing"></div>
          <div class="summary-card-content">
            <h4>Missing Tracks</h4>
            <p>${data.missingTracks.length} tracks not found in your Serato library</p>
          </div>
        </div>
      `;
    }

    // Update the toggle buttons with counts
    const foundTracksToggle = document.getElementById("found-tracks-toggle");
    const missingTracksToggle = document.getElementById(
      "missing-tracks-toggle"
    );
    const foundTracksCount = document.getElementById("found-tracks-count");
    const missingTracksCount = document.getElementById("missing-tracks-count");

    if (foundTracksCount) {
      foundTracksCount.textContent = data.foundTracks.length;
    }
    if (missingTracksCount) {
      missingTracksCount.textContent = data.missingTracks.length;
    }

    // Store the scan data for the modal
    window.scanResultsData = {
      foundTracks: data.foundTracks,
      missingTracks: data.missingTracks,
      scan: data.scan,
    };

    // Setup click handlers for the toggle buttons
    if (foundTracksToggle) {
      foundTracksToggle.onclick = () => {
        showScanTrackDetailsModal("found");
      };
    }
    if (missingTracksToggle) {
      missingTracksToggle.onclick = () => {
        showScanTrackDetailsModal("missing");
      };
    }

    // Scroll to results
    if (resultsSection) {
      resultsSection.scrollIntoView({ behavior: "smooth" });
    }
  } catch (error) {
    console.error("Error loading scan details:", error);
    alert("Failed to load scan details. Please try again.");
  }
}

function showScanTrackDetailsModal(type) {
  if (!window.scanResultsData) {
    console.error("No scan results data available");
    return;
  }

  const tracks =
    type === "found"
      ? window.scanResultsData.foundTracks
      : window.scanResultsData.missingTracks;
  const scan = window.scanResultsData.scan;

  // Update modal title
  const modalTitle = document.getElementById("track-modal-title");
  if (modalTitle) {
    modalTitle.textContent = `${scan.spotify_playlist_name || "Playlist"} - ${
      type.charAt(0).toUpperCase() + type.slice(1)
    } Tracks`;
  }

  // Generate track table
  const trackTableBody = document.getElementById("track-table-body");
  if (trackTableBody) {
    trackTableBody.innerHTML = generateScanTrackTable(tracks, type);
  }

  // Generate text list
  const trackListText = document.getElementById("track-list-text");
  if (trackListText) {
    trackListText.innerHTML = generateScanTrackList(tracks, type);
  }

  // Show modal
  const trackModal = document.getElementById("track-modal");
  if (trackModal) {
    trackModal.style.display = "flex";
    // Prevent body scrolling when modal is open
    document.body.style.overflow = "hidden";
  }

  // Setup view toggle buttons
  const tableViewBtn = document.getElementById("table-view-btn");
  const listViewBtn = document.getElementById("list-view-btn");
  const trackTableView = document.getElementById("track-table-view");
  const trackListView = document.getElementById("track-list-view");

  if (tableViewBtn && listViewBtn) {
    // Reset to table view by default
    tableViewBtn.classList.add("active");
    listViewBtn.classList.remove("active");
    if (trackTableView) trackTableView.style.display = "block";
    if (trackListView) trackListView.style.display = "none";

    // Table view button
    tableViewBtn.onclick = () => {
      tableViewBtn.classList.add("active");
      listViewBtn.classList.remove("active");
      if (trackTableView) trackTableView.style.display = "block";
      if (trackListView) trackListView.style.display = "none";
    };

    // List view button
    listViewBtn.onclick = () => {
      listViewBtn.classList.add("active");
      tableViewBtn.classList.remove("active");
      if (trackTableView) trackTableView.style.display = "none";
      if (trackListView) trackListView.style.display = "block";
    };
  }

  // Setup close button
  const closeBtn = document.getElementById("track-modal-close");
  if (closeBtn) {
    closeBtn.onclick = () => {
      if (trackModal) {
        trackModal.style.display = "none";
        // Restore body scrolling
        document.body.style.overflow = "auto";
      }
    };
  }

  // Close on overlay click
  if (trackModal) {
    trackModal.onclick = (e) => {
      if (e.target === trackModal) {
        trackModal.style.display = "none";
        // Restore body scrolling
        document.body.style.overflow = "auto";
      }
    };
  }
}

function generateScanTrackTable(tracks, type) {
  if (!tracks || tracks.length === 0) {
    return `<tr><td colspan="4" class="no-tracks">No ${type} tracks to display.</td></tr>`;
  }

  // Debug: Log the first track to see its structure
  if (tracks.length > 0) {
    console.log(`🔍 Debug: First ${type} track structure:`, tracks[0]);
    console.log(`🔍 Debug: Track keys:`, Object.keys(tracks[0]));
    if (tracks[0].versions) {
      console.log(`🔍 Debug: Versions array:`, tracks[0].versions);
      if (tracks[0].versions.length > 0) {
        console.log(
          `🔍 Debug: First version keys:`,
          Object.keys(tracks[0].versions[0])
        );
      }
    }
  }

  return tracks
    .map((track) => {
      // Extract Spotify track info (from 'name' or 'title' property)
      const spotifyTrackName = track.name || track.title || "Unknown Track";
      const spotifyArtistName = track.artist || "Unknown Artist";

      // Extract Serato track info and similarity (from 'versions' array or direct properties)
      let seratoTrackName = "Not found";
      let seratoArtistName = "";
      let similarityPercentage = track.similarityScore || null; // Use similarityScore directly

      let variationsText = "-";

      if (type === "found") {
        if (
          track.versions &&
          Array.isArray(track.versions) &&
          track.versions.length > 0
        ) {
          const bestMatch = track.versions[0];
          seratoTrackName =
            bestMatch.title || bestMatch.originalSeratoTitle || "Unknown Title";
          seratoArtistName =
            bestMatch.artist ||
            bestMatch.originalSeratoArtist ||
            "Unknown Artist";
          // If similarity is not directly on the track, try to get it from the best match
          if (similarityPercentage === null) {
            similarityPercentage =
              bestMatch.similarity ||
              bestMatch.score ||
              bestMatch.percentage ||
              null;
          }

          if (track.versions.length > 1) {
            variationsText = `${track.versions.length} variations (click to see all)`;
          } else {
            variationsText = "1 variation";
          }
        } else {
          // Fallback for older formats where Serato data might be directly on the track object
          seratoTrackName =
            track.seratoTitle ||
            track.originalSeratoTitle ||
            track.matchedTitle ||
            "Not found";
          seratoArtistName =
            track.seratoArtist ||
            track.originalSeratoArtist ||
            track.matchedArtist ||
            "";
          // Use existing similarity if available, otherwise fallback
          if (similarityPercentage === null) {
            similarityPercentage =
              track.similarity || track.score || track.percentage || null;
          }
          if (seratoTrackName !== "Not found") {
            variationsText = "1 variation"; // Assume one if found directly
          }
        }
      }

      // Format similarity percentage
      const displaySimilarity =
        similarityPercentage !== null && similarityPercentage !== undefined
          ? `${Math.round(similarityPercentage)}%`
          : type === "missing"
          ? "-"
          : "N/A";

      return `
        <tr>
          <td>${spotifyTrackName} - ${spotifyArtistName}</td>
          <td>${seratoTrackName} ${
        seratoArtistName ? `- ${seratoArtistName}` : ""
      }</td>
          <td class="similarity ${getPercentageClass(
            similarityPercentage
          )}">${displaySimilarity}</td>
          <td class="variations-cell" ${
            track.versions && track.versions.length > 1
              ? `onclick="showVariations('${spotifyTrackName}', ${JSON.stringify(
                  track.versions
                ).replace(/"/g, "&quot;")})"`
              : ""
          }>${variationsText}</td>
        </tr>
      `;
    })
    .join("");
}

// Function to show variations popup
function showVariations(trackName, versions) {
  if (!versions || versions.length === 0) return;

  // Create popup content
  let popupContent = `<h4>Variations for: ${trackName}</h4><ul>`;
  versions.forEach((version, index) => {
    const title =
      version.title || version.originalSeratoTitle || "Unknown Title";
    const artist =
      version.artist || version.originalSeratoArtist || "Unknown Artist";
    const filePath = version.filePath || "No file path";
    popupContent += `<li><strong>${title} - ${artist}</strong><br><small>${filePath}</small></li>`;
  });
  popupContent += "</ul>";

  // Create and show popup
  const popup = document.createElement("div");
  popup.className = "variations-popup";
  popup.innerHTML = `
    <div class="variations-popup-content">
      <div class="variations-popup-header">
        <h4>Variations for: ${trackName}</h4>
        <button class="variations-popup-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
      </div>
      <div class="variations-popup-body">
        ${versions
          .map((version) => {
            const title =
              version.title || version.originalSeratoTitle || "Unknown Title";
            const artist =
              version.artist ||
              version.originalSeratoArtist ||
              "Unknown Artist";
            const filePath = version.filePath || "No file path";
            return `<div class="variation-item">
            <strong>${title} - ${artist}</strong><br>
            <small>${filePath}</small>
          </div>`;
          })
          .join("")}
      </div>
    </div>
  `;

  // Add styles
  popup.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;

  const content = popup.querySelector(".variations-popup-content");
  content.style.cssText = `
    background: white;
    border-radius: 8px;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    padding: 20px;
    position: relative;
  `;

  const header = popup.querySelector(".variations-popup-header");
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid #eee;
  `;

  const closeBtn = popup.querySelector(".variations-popup-close");
  closeBtn.style.cssText = `
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #666;
  `;

  const body = popup.querySelector(".variations-popup-body");
  body.style.cssText = `
    max-height: 60vh;
    overflow-y: auto;
  `;

  const items = popup.querySelectorAll(".variation-item");
  items.forEach((item) => {
    item.style.cssText = `
      padding: 10px;
      border-bottom: 1px solid #f0f0f0;
      margin-bottom: 5px;
    `;
  });

  // Close on overlay click
  popup.onclick = (e) => {
    if (e.target === popup) {
      popup.remove();
    }
  };

  document.body.appendChild(popup);
}

function generateScanTrackList(tracks, type) {
  if (!tracks || tracks.length === 0) {
    return `No ${type} tracks to display.`;
  }

  return tracks
    .map((track) => {
      const spotifyTrackName = track.name || track.title || "Unknown Track";
      const spotifyArtistName = track.artist || "Unknown Artist";

      if (type === "found") {
        let seratoTrackName = "Not found";
        let seratoArtistName = "";

        if (
          track.versions &&
          Array.isArray(track.versions) &&
          track.versions.length > 0
        ) {
          const bestMatch = track.versions[0];
          seratoTrackName =
            bestMatch.title || bestMatch.originalSeratoTitle || "Unknown Title";
          seratoArtistName =
            bestMatch.artist ||
            bestMatch.originalSeratoArtist ||
            "Unknown Artist";
        } else {
          // Fallback for older formats where Serato data might be directly on the track object
          seratoTrackName =
            track.seratoTitle ||
            track.originalSeratoTitle ||
            track.matchedTitle ||
            "Not found";
          seratoArtistName =
            track.seratoArtist ||
            track.originalSeratoArtist ||
            track.matchedArtist ||
            "";
        }

        if (seratoTrackName !== "Not found") {
          let variationsInfo = "";
          if (track.versions && track.versions.length > 1) {
            variationsInfo = ` (${track.versions.length} variations available)`;
          }
          return `${spotifyTrackName} - ${spotifyArtistName} → ${seratoTrackName} - ${seratoArtistName}${variationsInfo}`;
        } else {
          return `${spotifyTrackName} - ${spotifyArtistName} (Serato match not found)`;
        }
      } else {
        return `${spotifyTrackName} - ${spotifyArtistName}`;
      }
    })
    .join("\n");
}
