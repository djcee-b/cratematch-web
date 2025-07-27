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

  // Setup settings button after user info is shown
  setupSettingsButton();
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

// Threshold buttons
const thresholdButtons = document.querySelectorAll(".threshold-btn");
thresholdButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const value = parseInt(button.dataset.value);

    // Update hidden input
    threshold.value = value;
    thresholdValue.textContent = `${value}%`;

    // Update active button
    thresholdButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    // Update example
    updateThresholdExample(value);
  });
});

// Initialize threshold example
updateThresholdExample(threshold.value);

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
  updateThresholdExample(90);

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
    // Disable process button and show processing overlay
    processBtn.disabled = true;
    processBtn.textContent = "Processing...";

    // Show the processing overlay
    processingOverlay.style.display = "flex";

    // Show progress container and reset progress
    const progressContainer = document.getElementById("progress-container");
    const progressFill = document.getElementById("progress-fill");
    const progressText = document.getElementById("progress-text");

    if (progressContainer) {
      progressContainer.style.display = "block";
    }

    // Reset progress to 0
    if (progressFill) {
      progressFill.style.width = "0%";
    }

    if (progressText) {
      progressText.textContent = "Starting...";
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

    eventSource.onmessage = function (event) {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "progress") {
          const percentage = Math.round(data.progress);
          const progressFill = document.getElementById("progress-fill");
          const progressText = document.getElementById("progress-text");

          if (progressFill) {
            progressFill.style.width = `${percentage}%`;
          }

          if (progressText) {
            progressText.textContent =
              data.message || `Processing... ${percentage}%`;
          }
        } else if (data.type === "complete") {
          console.log("Processing complete:", data);
          eventSource.close();
          // Hide processing overlay
          processingOverlay.style.display = "none";
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
          // Hide processing overlay
          processingOverlay.style.display = "none";
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
      // Hide processing overlay
      processingOverlay.style.display = "none";
      processBtn.disabled = false;
      processBtn.textContent = "Process Playlist";
    };
  } catch (error) {
    console.error("Processing error:", error);
    showError("Processing failed. Please try again.");
    // Hide processing overlay
    processingOverlay.style.display = "none";
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
          <div class="stat-value found clickable" id="found-btn">${
            results.foundTracks
          }</div>
        </div>
        <div class="stat">
          <div class="stat-label">Missing</div>
          <div class="stat-value missing clickable" id="missing-btn">${
            (results.totalTracks || 0) - results.foundTracks
          }</div>
        </div>
      </div>
    `;
    resultsDetails.innerHTML = detailsHtml;

    // Store results data for popup
    window.resultsData = results;

    // Setup click handlers for the buttons
    setupResultsButtons();
  } else {
    resultsDetails.innerHTML =
      "<p>No tracks were found in your Serato library that match this playlist.</p>";
  }

  // Scroll to results
  resultsSection.scrollIntoView({ behavior: "smooth" });
}

function generateTrackTable(tracks, type) {
  console.log(`Generating ${type} table with tracks:`, tracks);

  if (!tracks || tracks.length === 0) {
    return `<div class="no-tracks">No ${type} tracks to display.</div>`;
  }

  const tableRows = tracks
    .map((track, index) => {
      console.log(`Processing track ${index}:`, track);
      console.log(`Track keys:`, Object.keys(track));

      // Try different possible property names for the data
      const matchPercentage =
        track.similarityScore ||
        track.matchPercentage ||
        track.percentage ||
        track.matchPercent ||
        track.score ||
        track.similarity ||
        "N/A";
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
        if (track.versions.length === 1) {
          seratoTrack = {
            title: track.versions[0].originalSeratoTitle,
            artist: track.versions[0].originalSeratoArtist,
          };
        } else {
          // Show first variation with popup for others
          seratoTrack = {
            title: track.versions[0].originalSeratoTitle,
            artist: track.versions[0].originalSeratoArtist,
          };
          variationsPopup = `
                <div class="variations-popup">
                  <div class="variations-popup-title">All ${
                    track.versions.length
                  } versions found:</div>
                  ${track.versions
                    .map(
                      (v) =>
                        `<div class="variations-popup-item">${v.originalSeratoTitle} - ${v.originalSeratoArtist}</div>`
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
                  ${matchPercentage}%
                </span>
              </td>
              <td class="track-variations status-cell">
                ${
                  track.versions && track.versions.length > 1
                    ? `<span class="variations-indicator">+${
                        track.versions.length - 1
                      }</span>`
                    : "<span class='no-variations'>-</span>"
                }
                ${variationsPopup}
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
  if (percentage === "N/A") return "percentage-na";
  const num = parseInt(percentage);
  if (num >= 95) return "percentage-excellent";
  if (num >= 85) return "percentage-good";
  if (num >= 75) return "percentage-fair";
  return "percentage-poor";
}

function setupResultsButtons() {
  const foundBtn = document.getElementById("found-btn");
  const missingBtn = document.getElementById("missing-btn");

  if (foundBtn) {
    foundBtn.addEventListener("click", () => {
      showTrackDetailsModal("found");
    });
  }

  if (missingBtn) {
    missingBtn.addEventListener("click", () => {
      showTrackDetailsModal("missing");
    });
  }
}

function showTrackDetailsModal(type) {
  const modal = document.getElementById("track-details-modal");
  const title = document.getElementById("track-details-title");
  const foundTabBtn = document.getElementById("found-tab-btn");
  const missingTabBtn = document.getElementById("missing-tab-btn");
  const foundContent = document.getElementById("found-tracks-content");
  const missingContent = document.getElementById("missing-tracks-content");

  if (!window.resultsData) {
    console.error("No results data available");
    return;
  }

  const results = window.resultsData;

  // Update title
  title.textContent = type === "found" ? "Found Tracks" : "Missing Tracks";

  // Update tab button text with counts
  foundTabBtn.textContent = `Found Tracks (${results.foundTracks})`;
  missingTabBtn.textContent = `Missing Tracks (${
    (results.totalTracks || 0) - results.foundTracks
  })`;

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

  foundContent.innerHTML = generateTrackTable(foundTracks, "found");
  missingContent.innerHTML = generateTrackTable(missingTracks, "missing");

  // Set initial active tab
  const tabButtons = document.querySelectorAll("#track-details-modal .tab-btn");
  const tabContents = document.querySelectorAll(
    "#track-details-modal .table-tab"
  );

  tabButtons.forEach((btn) => btn.classList.remove("active"));
  tabContents.forEach((content) => content.classList.remove("active"));

  if (type === "found") {
    foundTabBtn.classList.add("active");
    document.getElementById("found-tab").classList.add("active");
  } else {
    missingTabBtn.classList.add("active");
    document.getElementById("missing-tab").classList.add("active");
  }

  // Show modal
  modal.style.display = "flex";

  // Setup tab switching within modal
  setupModalTableTabs();

  // Setup variations expand/collapse
  setupVariationsHandlers();

  // Setup close button
  const closeBtn = document.getElementById("track-details-close");
  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.style.display = "none";
    };
  }

  // Close on overlay click
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  };
}

function setupModalTableTabs() {
  const tabButtons = document.querySelectorAll("#track-details-modal .tab-btn");
  const tabContents = document.querySelectorAll(
    "#track-details-modal .table-tab"
  );

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetTab = button.dataset.tab;

      // Update active button
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Update active content
      tabContents.forEach((content) => content.classList.remove("active"));
      document.getElementById(`${targetTab}-tab`).classList.add("active");
    });
  });
}

function setupVariationsHandlers() {
  const variationIndicators = document.querySelectorAll(
    ".variations-indicator"
  );

  variationIndicators.forEach((indicator) => {
    indicator.addEventListener("click", (e) => {
      e.stopPropagation();
      const popup = indicator.parentElement.querySelector(".variations-popup");
      if (popup) {
        // Close any other open popups first
        document.querySelectorAll(".variations-popup.show").forEach((p) => {
          if (p !== popup) p.classList.remove("show");
        });

        popup.classList.toggle("show");
      }
    });
  });

  // Close popups when clicking outside
  document.addEventListener("click", (e) => {
    if (
      !e.target.closest(".variations-indicator") &&
      !e.target.closest(".variations-popup")
    ) {
      document.querySelectorAll(".variations-popup.show").forEach((popup) => {
        popup.classList.remove("show");
      });
    }
  });
}

function setupTableTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".table-tab");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetTab = button.dataset.tab;

      // Update active button
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Update active content
      tabContents.forEach((content) => content.classList.remove("active"));
      document.getElementById(`${targetTab}-tab`).classList.add("active");
    });
  });
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
function setupSettingsButton() {
  // Setup settings button to redirect to settings page
  console.log("Setting up settings button:", settingsBtn);
  if (settingsBtn) {
    // Remove any existing event listeners
    settingsBtn.removeEventListener("click", handleSettingsClick);
    // Add new event listener
    settingsBtn.addEventListener("click", handleSettingsClick);
    console.log("Settings button event listener added");
  } else {
    console.error("Settings button not found!");
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
    .join("\n");

  // Update modal content
  document.getElementById("text-list-tracks").textContent = textList;

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
