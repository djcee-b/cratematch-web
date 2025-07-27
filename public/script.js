// Global state
let currentUser = null;
let authToken = null;
let uploadedDatabase = null;
let currentDatabaseFileName = null;

// DOM elements
const loadingOverlay = document.getElementById("loading-overlay");
const userInfo = document.getElementById("user-info");
const userEmail = document.getElementById("user-email");
const subscriptionStatus = document.getElementById("subscription-status");
const settingsBtn = document.getElementById("settings-btn");
const signOutBtn = document.getElementById("sign-out-btn");
const databaseDate = document.getElementById("database-date");

// Upgrade elements
const upgradeBanner = document.getElementById("upgrade-banner");
const upgradeBtnBanner = document.getElementById("upgrade-btn-banner");

// Database status bar elements
const databaseStatusBar = document.getElementById("database-status-bar");
const statusText = document.querySelector(".status-text");
const statusDot = document.querySelector(".status-dot");

const uploadArea = document.getElementById("upload-area");
const uploadBtn = document.getElementById("upload-btn");
const databaseFile = document.getElementById("databaseFile");
const uploadStatus = document.getElementById("upload-status");
const uploadMessage = document.getElementById("upload-message");

const playlistUrl = document.getElementById("playlistUrl");
const threshold = document.getElementById("threshold");
const thresholdValue = document.getElementById("thresholdValue");
const processBtn = document.getElementById("process-btn");

const resultsSection = document.getElementById("results-section");
const resultsSummary = document.getElementById("results-summary");
const resultsDetails = document.getElementById("results-details");
const downloadSection = document.getElementById("download-section");
const downloadBtn = document.getElementById("download-btn");
const newPlaylistBtn = document.getElementById("new-playlist-btn");

const processingOverlay = document.getElementById("processing-overlay");
const errorModal = document.getElementById("error-modal");
const errorMessage = document.getElementById("error-message");
const errorClose = document.getElementById("error-close");
const errorOk = document.getElementById("error-ok");

const subscriptionModal = document.getElementById("subscription-modal");
const subscriptionClose = document.getElementById("subscription-close");

// Check authentication on page load
async function checkAuth() {
  const token = localStorage.getItem("authToken");
  if (!token) {
    // No token, redirect to auth page
    window.location.href = "/auth.html";
    return;
  }

  try {
    const response = await fetch("/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;
      authToken = token;
      updateUserInterface(data);

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
    } else {
      // Token is invalid, redirect to auth page
      localStorage.removeItem("authToken");
      window.location.href = "/auth.html";
    }
  } catch (error) {
    console.error("Auth check error:", error);
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
  userEmail.textContent = data.user.email;

  const status = data.subscriptionStatus || "trial";
  let statusText, statusClass;

  switch (status) {
    case "trial":
      statusText = "Free Trial";
      statusClass = "trial";
      // Show upgrade banner for trial users
      if (upgradeBanner) {
        upgradeBanner.style.display = "block";
      }
      break;
    case "premium":
      statusText = "Premium";
      statusClass = "active";
      // Hide upgrade banner for premium users
      if (upgradeBanner) {
        upgradeBanner.style.display = "none";
      }
      break;
    case "free":
      statusText = "Free";
      statusClass = "free";
      // Show upgrade banner for free users
      if (upgradeBanner) {
        upgradeBanner.style.display = "block";
      }
      break;
    default:
      statusText = "Free";
      statusClass = "free";
      // Show upgrade banner for free users
      if (upgradeBanner) {
        upgradeBanner.style.display = "block";
      }
  }

  subscriptionStatus.textContent = statusText;
  subscriptionStatus.className = `subscription-status ${statusClass}`;

  userInfo.style.display = "flex";
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
          databaseDate.textContent =
            date.toLocaleDateString() + " " + date.toLocaleTimeString();
        } else {
          databaseDate.textContent = "Recently";
        }

        processBtn.disabled = false;

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
  databaseStatusBar.style.display = "block";
  statusText.textContent = message;

  if (status === "loading") {
    statusDot.className = "status-dot loading";
    statusText.className = "status-text loading";
  } else if (status === "loaded") {
    statusDot.className = "status-dot";
    statusText.className = "status-text";
  }
}

// Handle sign out
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
    localStorage.removeItem("authToken");
    window.location.href = "/auth.html";
  }
});

// File upload handling (removed from main page - now in settings)

// File upload handling moved to settings modal

function isValidDatabaseFile(file) {
  return true; // Accept any file, let MLT.js validate
}

function updateUploadStatus(message, type) {
  uploadMessage.textContent = message;
  uploadMessage.className = `status-message ${type}`;
  uploadStatus.style.display = "block";
}

// Threshold slider
threshold.addEventListener("input", () => {
  thresholdValue.textContent = `${threshold.value}%`;
});

// Enable process button when URL is entered
playlistUrl.addEventListener("input", () => {
  processBtn.disabled = !playlistUrl.value.trim() || !uploadedDatabase;
});

// Process playlist
processBtn.addEventListener("click", processPlaylist);

// New playlist button
newPlaylistBtn.addEventListener("click", () => {
  // Reset form fields
  playlistUrl.value = "";
  threshold.value = 90;
  thresholdValue.textContent = "90%";

  // Reset button state
  processBtn.disabled = true;
  processBtn.textContent = "Process Playlist";

  // Clear any error messages
  const errorMessage = document.getElementById("error-message");
  if (errorMessage) {
    errorMessage.textContent = "";
  }

  // Reset results section
  if (resultsSummary) resultsSummary.textContent = "";
  if (resultsDetails) resultsDetails.innerHTML = "";
  if (downloadSection) downloadSection.style.display = "none";

  // Hide results and show process section
  resultsSection.style.display = "none";
  document.getElementById("process-section").style.display = "block";

  // Restore original process section content if it was modified
  const sectionContent = document.querySelector(
    "#process-section .section-content"
  );
  if (sectionContent && !sectionContent.querySelector(".form-group")) {
    // If the content was replaced with processing state, restore it
    sectionContent.innerHTML = `
      <div class="form-group">
        <label for="playlist-url">Spotify Playlist URL</label>
        <input
          type="url"
          id="playlist-url"
          placeholder="https://open.spotify.com/playlist/..."
          required
        />
      </div>
      <div class="form-group">
        <label for="threshold">Match Threshold</label>
        <input
          type="range"
          id="threshold"
          min="70"
          max="100"
          value="90"
          class="threshold-slider"
        />
        <div class="threshold-value" id="threshold-value">90%</div>
      </div>
      <button type="button" id="process-btn" class="process-btn" disabled>
        Process Playlist
      </button>
    `;

    // Re-attach event listeners to the restored elements
    const restoredPlaylistUrl = document.getElementById("playlist-url");
    const restoredThreshold = document.getElementById("threshold");
    const restoredThresholdValue = document.getElementById("threshold-value");
    const restoredProcessBtn = document.getElementById("process-btn");

    if (restoredPlaylistUrl) {
      restoredPlaylistUrl.addEventListener("input", () => {
        restoredProcessBtn.disabled =
          !restoredPlaylistUrl.value.trim() || !uploadedDatabase;
      });
    }

    if (restoredThreshold) {
      restoredThreshold.addEventListener("input", () => {
        restoredThresholdValue.textContent = `${restoredThreshold.value}%`;
      });
    }

    if (restoredProcessBtn) {
      restoredProcessBtn.addEventListener("click", processPlaylist);
    }
  }
});

async function processPlaylist() {
  const url = playlistUrl.value.trim();
  const thresholdValue = threshold.value;

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
    // Disable process button and show processing state
    processBtn.disabled = true;
    processBtn.textContent = "Processing...";

    // Update the process section to show progress
    const sectionContent = document.querySelector(
      "#process-section .section-content"
    );
    const originalContent = sectionContent.innerHTML;

    sectionContent.innerHTML = `
      <div class="processing-state">
        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
          </div>
          <div class="progress-text" id="progress-text">Starting...</div>
        </div>
      </div>
    `;

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

    eventSource.onmessage = function (event) {
      console.log("EventSource message received:", event.data);

      try {
        const data = JSON.parse(event.data);
        console.log("Parsed data:", data);

        if (data.type === "progress") {
          const percentage = Math.round(data.progress);
          console.log(`Updating progress to: ${percentage}%`);
          const progressFill = document.getElementById("progress-fill");
          const progressText = document.getElementById("progress-text");
          if (progressFill) progressFill.style.width = `${percentage}%`;
          if (progressText)
            progressText.textContent =
              data.message || `Processing... ${percentage}%`;
        } else if (data.type === "complete") {
          console.log("Processing complete:", data);
          eventSource.close();
          console.log("Calling showResults with:", {
            results: data.results,
            crateFile: data.crateFile,
            downloadUrl: data.downloadUrl,
            hasCrateFile: data.hasCrateFile,
          });
          showResults(
            data.results,
            data.crateFile,
            data.downloadUrl,
            data.hasCrateFile
          );
        } else if (data.type === "error") {
          console.error("Processing error:", data);
          eventSource.close();
          showError(data.message || "Processing failed");
          // Restore original content
          const sectionContent = document.querySelector(
            "#process-section .section-content"
          );
          sectionContent.innerHTML = originalContent;
          processBtn.disabled = false;
          processBtn.textContent = "Process Playlist";
        }
      } catch (error) {
        console.error("Error parsing EventSource data:", error, event.data);
      }
    };

    eventSource.onerror = function (error) {
      console.error("EventSource error:", error);
      eventSource.close();
      showError("Connection lost. Please try again.");
      // Restore original content
      const sectionContent = document.querySelector(
        "#process-section .section-content"
      );
      sectionContent.innerHTML = originalContent;
      processBtn.disabled = false;
      processBtn.textContent = "Process Playlist";
    };
  } catch (error) {
    console.error("Processing error:", error);
    showError("Processing failed. Please try again.");
    // Restore original content
    const sectionContent = document.querySelector(
      "#process-section .section-content"
    );
    sectionContent.innerHTML = originalContent;
    processBtn.disabled = false;
    processBtn.textContent = "Process Playlist";
  }
}

function showResults(results, crateFile, downloadUrl, hasCrateFile) {
  console.log("showResults called with:", {
    results,
    crateFile,
    downloadUrl,
    hasCrateFile,
  });

  // Hide the process section and show results
  document.getElementById("process-section").style.display = "none";
  resultsSection.style.display = "block";

  // Update summary
  let summaryText = "";
  if (hasCrateFile && results.foundTracks && results.foundTracks > 0) {
    summaryText = `🎉 Crate is ready! Found ${results.foundTracks} tracks in your library.`;
  } else if (results.foundTracks && results.foundTracks > 0) {
    summaryText = `✅ Processing complete! Found ${results.foundTracks} tracks in your library.`;
  } else {
    summaryText = "❌ No matching tracks found in your Serato library.";
  }

  resultsSummary.textContent = summaryText;

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
    downloadSection.style.display = "block";
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
  } else {
    downloadSection.style.display = "none";
  }

  // Show details
  if (results.foundTracks && results.foundTracks > 0) {
    const detailsHtml = `
      <div class="results-stats">
        <div class="stat">
          <div class="stat-label">Total Tracks</div>
          <div class="stat-value">${results.totalTracks || 0}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Found in Library</div>
          <div class="stat-value found">${results.foundTracks}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Missing</div>
          <div class="stat-value missing">${
            (results.totalTracks || 0) - results.foundTracks
          }</div>
        </div>
      </div>
    `;
    resultsDetails.innerHTML = detailsHtml;
  } else {
    resultsDetails.innerHTML =
      "<p>No tracks were found in your Serato library that match this playlist.</p>";
  }

  // Scroll to results
  resultsSection.scrollIntoView({ behavior: "smooth" });
}

// Error handling
function showError(message) {
  errorMessage.textContent = message;
  errorModal.style.display = "flex";
}

errorClose.addEventListener("click", () => {
  errorModal.style.display = "none";
});

errorOk.addEventListener("click", () => {
  errorModal.style.display = "none";
});

// Subscription modal
function showSubscriptionModal() {
  subscriptionModal.style.display = "flex";
}

subscriptionClose.addEventListener("click", () => {
  subscriptionModal.style.display = "none";
});

// Close modals when clicking outside
window.addEventListener("click", (e) => {
  if (e.target === errorModal) {
    errorModal.style.display = "none";
  }
  if (e.target === subscriptionModal) {
    subscriptionModal.style.display = "none";
  }
});

// Settings functionality
function setupSettings() {
  const settingsBtn = document.getElementById("settings-btn");
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

  // Open settings page
  settingsBtn.addEventListener("click", () => {
    window.location.href = "/settings.html";
  });

  // Close settings modal
  settingsClose.addEventListener("click", () => {
    settingsModal.style.display = "none";
  });

  // Close modal when clicking outside
  window.addEventListener("click", (e) => {
    if (e.target === settingsModal) {
      settingsModal.style.display = "none";
    }
  });

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
        showSettingsUploadStatus(
          "Your trial has expired. Please upgrade to continue.",
          "error"
        );
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
  // Add a timeout to prevent infinite loading
  setTimeout(() => {
    if (loadingOverlay && !loadingOverlay.classList.contains("hidden")) {
      console.warn("Auth check taking too long, hiding loading overlay");
      hideLoadingOverlay();
    }
  }, 10000); // 10 second timeout
  
  checkAuth();
  setupSettings();
  setupUpgradeButton();
});

// Setup upgrade button
function setupUpgradeButton() {
  if (upgradeBtnBanner) {
    upgradeBtnBanner.addEventListener("click", () => {
      window.location.href = "/pricing.html";
    });
  }
}
