// Global state
let currentUser = null;
let authToken = null;
let scanHistory = [];
let filteredHistory = [];

// DOM elements
let loadingOverlay,
  headerNav,
  trialBanner,
  trialCountdown,
  upgradeBtnBanner,
  signOutBtn;
let refreshHistoryBtn, deleteAllHistoryBtn, refreshText, refreshSpinner;
let historyList,
  historyStats,
  totalScans,
  totalTracks,
  totalFound,
  totalMissing;
let searchFilter, sortFilter;
let errorModal, errorMessage, errorClose;
let trackModal,
  trackModalTitle,
  trackTableBody,
  trackListText,
  trackTableView,
  trackListView;
let tableViewBtn, listViewBtn, trackModalClose;

// Initialize DOM elements
function initializeDOMElements() {
  // Loading and user elements
  loadingOverlay = document.getElementById("loading-overlay");
  headerNav = document.getElementById("header-nav");
  trialBanner = document.getElementById("trial-banner");
  trialCountdown = document.getElementById("trial-countdown");
  upgradeBtnBanner = document.getElementById("upgrade-btn-banner");
  signOutBtn = document.getElementById("sign-out-btn");

  // History controls
  refreshHistoryBtn = document.getElementById("refresh-history-btn");
  deleteAllHistoryBtn = document.getElementById("delete-all-history-btn");
  refreshText = document.getElementById("refresh-text");
  refreshSpinner = document.getElementById("refresh-spinner");

  // History display
  historyList = document.getElementById("history-list");

  // Filters
  searchFilter = document.getElementById("search-filter");
  sortFilter = document.getElementById("sort-filter");

  // Modals
  errorModal = document.getElementById("error-modal");
  errorMessage = document.getElementById("error-message");
  errorClose = document.getElementById("error-close");

  // Track modal
  trackModal = document.getElementById("track-modal");
  trackModalTitle = document.getElementById("track-modal-title");
  trackTableBody = document.getElementById("track-table-body");
  trackListText = document.getElementById("track-list-text");
  trackTableView = document.getElementById("track-table-view");
  trackListView = document.getElementById("track-list-view");
  tableViewBtn = document.getElementById("table-view-btn");
  listViewBtn = document.getElementById("list-view-btn");
  trackModalClose = document.getElementById("track-modal-close");
}

// Setup event listeners
function setupEventListeners() {
  // Refresh history
  if (refreshHistoryBtn) {
    refreshHistoryBtn.addEventListener("click", () => {
      loadScanHistory();
    });
  }

  // Delete all history
  if (deleteAllHistoryBtn) {
    deleteAllHistoryBtn.addEventListener("click", async () => {
      if (
        confirm(
          "Are you sure you want to delete all scan history? This action cannot be undone."
        )
      ) {
        try {
          setRefreshLoading(true);
          const response = await fetch("/api/scan-history", {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          });

          if (response.ok) {
            console.log("✅ All scan history deleted successfully");
            loadScanHistory();
          } else {
            console.error("❌ Failed to delete all scan history");
            showError("Failed to delete all scan history");
          }
        } catch (error) {
          console.error("❌ Error deleting all scan history:", error);
          showError("Error deleting all scan history");
        } finally {
          setRefreshLoading(false);
        }
      }
    });
  }

  // Search filter
  if (searchFilter) {
    searchFilter.addEventListener("input", () => {
      filterAndDisplayHistory();
    });
  }

  // Sort filter
  if (sortFilter) {
    sortFilter.addEventListener("change", () => {
      filterAndDisplayHistory();
    });
  }

  // Error modal
  if (errorClose) {
    errorClose.addEventListener("click", () => {
      if (errorModal) {
        errorModal.style.display = "none";
      }
    });
  }

  // Track modal controls
  if (tableViewBtn && listViewBtn) {
    tableViewBtn.addEventListener("click", () => {
      tableViewBtn.classList.add("active");
      listViewBtn.classList.remove("active");
      if (trackTableView) trackTableView.style.display = "block";
      if (trackListView) trackListView.style.display = "none";
    });

    listViewBtn.addEventListener("click", () => {
      listViewBtn.classList.add("active");
      tableViewBtn.classList.remove("active");
      if (trackTableView) trackTableView.style.display = "none";
      if (trackListView) trackListView.style.display = "block";
    });
  }

  // Track modal close
  if (trackModalClose) {
    trackModalClose.addEventListener("click", () => {
      if (trackModal) {
        trackModal.style.display = "none";
        document.body.style.overflow = "auto";
      }
    });
  }

  // Trial banner upgrade button
  if (upgradeBtnBanner) {
    upgradeBtnBanner.addEventListener("click", () => {
      window.location.href = "/pricing.html";
    });
  }

  // Trial expiration modal event listeners
  const trialUpgradeBtn = document.getElementById("trial-upgrade-btn");
  const trialFreeBtn = document.getElementById("trial-free-btn");
  const trialRemindBtn = document.getElementById("trial-remind-btn");

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
          const trialExpirationModal = document.getElementById(
            "trial-expiration-modal"
          );
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
      const trialExpirationModal = document.getElementById(
        "trial-expiration-modal"
      );
      if (trialExpirationModal) {
        trialExpirationModal.style.display = "none";
      }

      // Set a flag to show the modal again in 24 hours
      localStorage.setItem("trialExpirationRemindLater", Date.now().toString());
    });
  }

  // Close modal on overlay click
  if (trackModal) {
    trackModal.addEventListener("click", (e) => {
      if (e.target === trackModal) {
        trackModal.style.display = "none";
        document.body.style.overflow = "auto";
      }
    });
  }

  // Sign out
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
        localStorage.removeItem("authToken");
        window.location.href = "/auth.html";
      }
    });
  }
}

// Set refresh loading state
function setRefreshLoading(loading) {
  if (refreshText && refreshSpinner) {
    if (loading) {
      refreshText.style.display = "none";
      refreshSpinner.style.display = "inline-block";
      refreshHistoryBtn.disabled = true;
    } else {
      refreshText.style.display = "inline";
      refreshSpinner.style.display = "none";
      refreshHistoryBtn.disabled = false;
    }
  }
}

// Check authentication
async function checkAuth() {
  const token = localStorage.getItem("authToken");
  if (!token) {
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

      // Start heartbeat mechanism
      startHeartbeat();

      loadScanHistory();
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
            loadScanHistory();
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

// Update user interface
function updateUserInterface(data) {
  const status = data.subscriptionStatus || "trial";

  // Handle trial banner
  if (trialBanner) {
    if (status === "trial") {
      trialBanner.style.display = "block";
      // Start countdown timer for trial users
      const trialEndDate =
        data.machine?.trial_end ||
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      startTrialCountdown(trialEndDate);
    } else {
      trialBanner.style.display = "none";
    }
  }

  // Show header navigation
  if (headerNav) {
    headerNav.style.display = "flex";
  }
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

// Trial expiration modal functions
function showTrialExpirationModal() {
  const modal = document.getElementById("trial-expiration-modal");
  if (modal) {
    modal.style.display = "flex";
  }
}

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

  // Calculate time units
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

// Hide loading overlay
function hideLoadingOverlay() {
  if (loadingOverlay) {
    loadingOverlay.classList.add("hidden");
    setTimeout(() => {
      loadingOverlay.style.display = "none";
    }, 300);
  }
}

// Load scan history
async function loadScanHistory() {
  try {
    setRefreshLoading(true);
    const response = await fetch("/api/scan-history", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      scanHistory = data.scanHistory || [];
      filterAndDisplayHistory();
    } else {
      console.error("Failed to load scan history:", response.status);
      showError("Failed to load scan history");
    }
  } catch (error) {
    console.error("Error loading scan history:", error);
    showError("Error loading scan history");
  } finally {
    setRefreshLoading(false);
  }
}

// Filter and display history
function filterAndDisplayHistory() {
  const searchTerm = searchFilter ? searchFilter.value.toLowerCase() : "";
  const sortBy = sortFilter ? sortFilter.value : "date-desc";

  // Filter by search term
  filteredHistory = scanHistory.filter((scan) => {
    const playlistName = (scan.spotify_playlist_name || "").toLowerCase();
    const url = (scan.spotify_playlist_url || "").toLowerCase();
    return playlistName.includes(searchTerm) || url.includes(searchTerm);
  });

  // Sort filtered history
  filteredHistory.sort((a, b) => {
    switch (sortBy) {
      case "date-desc":
        return new Date(b.created_at) - new Date(a.created_at);
      case "date-asc":
        return new Date(a.created_at) - new Date(b.created_at);
      case "name-asc":
        return (a.spotify_playlist_name || "").localeCompare(
          b.spotify_playlist_name || ""
        );
      case "name-desc":
        return (b.spotify_playlist_name || "").localeCompare(
          a.spotify_playlist_name || ""
        );
      case "tracks-desc":
        return (b.total_tracks || 0) - (a.total_tracks || 0);
      case "tracks-asc":
        return (a.total_tracks || 0) - (b.total_tracks || 0);
      default:
        return new Date(b.created_at) - new Date(a.created_at);
    }
  });

  displayHistory();
}

// Display history
function displayHistory() {
  if (!historyList) return;

  if (filteredHistory.length === 0) {
    historyList.innerHTML = `
            <div class="empty-history">
                <div class="empty-history-icon">📊</div>
                <h3>No scan history found</h3>
                <p>${
                  scanHistory.length === 0
                    ? "You haven't processed any playlists yet."
                    : "No playlists match your search criteria."
                }</p>
                <a href="/app.html" class="back-to-app">Start Processing Playlists</a>
            </div>
        `;
    return;
  }

  historyList.innerHTML = filteredHistory
    .map((scan) => {
      const date = new Date(scan.created_at).toLocaleDateString();
      const time = new Date(scan.created_at).toLocaleTimeString();

      return `
                <div class="history-item" data-scan-id="${scan.id}">
                    <div class="history-item-header">
                        <h3 class="history-item-title">${
                          scan.spotify_playlist_name || "Playlist"
                        }</h3>
                        <span class="history-item-date">${date} at ${time}</span>
                    </div>
                    <a href="${
                      scan.spotify_playlist_url
                    }" target="_blank" class="spotify-btn">
                        Spotify
                    </a>
                    <div class="history-item-stats">
                        <div class="history-stat">
                            <div class="history-stat-icon found"></div>
                            <span>${scan.found_tracks_count} found</span>
                        </div>
                        <div class="history-stat">
                            <div class="history-stat-icon missing"></div>
                            <span>${scan.missing_tracks_count} missing</span>
                        </div>
                        <div class="history-stat">
                            <span>${scan.total_tracks} total tracks</span>
                        </div>
                    </div>
                    <div class="history-item-actions">
                        <button class="scan-history-view-btn" data-scan-id="${
                          scan.id
                        }">
                            View Details
                        </button>
                        <button class="scan-history-delete-btn" data-scan-id="${
                          scan.id
                        }">
                            Delete
                        </button>
                    </div>
                </div>
            `;
    })
    .join("");

  // Add event listeners to buttons
  addHistoryItemEventListeners();
}

// Add event listeners to history items
function addHistoryItemEventListeners() {
  const historyItems = historyList.querySelectorAll(".history-item");
  historyItems.forEach((item) => {
    const viewBtn = item.querySelector(".scan-history-view-btn");
    const deleteBtn = item.querySelector(".scan-history-delete-btn");

    if (viewBtn) {
      viewBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const scanId = viewBtn.getAttribute("data-scan-id");
        loadScanDetails(scanId);
      });
    }

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
              loadScanHistory();
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

// Update history statistics

// Load scan details
async function loadScanDetails(scanId) {
  try {
    const response = await fetch(`/api/scan-history/${scanId}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      window.scanResultsData = data;
      showScanTrackDetailsModal("found");
    } else {
      console.error("Failed to load scan details:", response.status);
      showError("Failed to load scan details");
    }
  } catch (error) {
    console.error("Error loading scan details:", error);
    showError("Error loading scan details");
  }
}

// Show scan track details modal
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
  if (trackModalTitle) {
    trackModalTitle.textContent = `${
      scan.spotify_playlist_name || "Playlist"
    } - ${type.charAt(0).toUpperCase() + type.slice(1)} Tracks`;
  }

  // Generate track table
  if (trackTableBody) {
    trackTableBody.innerHTML = generateScanTrackTable(tracks, type);
  }

  // Generate text list
  if (trackListText) {
    trackListText.innerHTML = generateScanTrackList(tracks, type);
  }

  // Show modal
  if (trackModal) {
    trackModal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  // Setup view toggle buttons
  if (tableViewBtn && listViewBtn) {
    // Reset to table view by default
    tableViewBtn.classList.add("active");
    listViewBtn.classList.remove("active");
    if (trackTableView) trackTableView.style.display = "block";
    if (trackListView) trackListView.style.display = "none";
  }
}

// Generate scan track table (reuse from script.js)
function generateScanTrackTable(tracks, type) {
  if (!tracks || tracks.length === 0) {
    return `<tr><td colspan="4" class="no-tracks">No ${type} tracks to display.</td></tr>`;
  }

  // Sort tracks by similarity percentage (highest first)
  const sortedTracks = tracks.sort((a, b) => {
    const aPercentage =
      a.similarityScore ||
      a.similarity ||
      a.score ||
      a.percentage ||
      a.matchPercentage ||
      a.matchPercent ||
      0;
    const bPercentage =
      b.similarityScore ||
      b.similarity ||
      b.score ||
      b.percentage ||
      b.matchPercentage ||
      b.matchPercent ||
      0;
    return bPercentage - aPercentage; // Sort descending (highest first)
  });

  return sortedTracks
    .map((track) => {
      const spotifyTrackName = track.name || track.title || "Unknown Track";
      const spotifyArtistName = track.artist || "Unknown Artist";

      let seratoTrackName = "Not found";
      let seratoArtistName = "";
      let similarityPercentage = track.similarityScore || null;
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

          if (similarityPercentage === null) {
            similarityPercentage =
              bestMatch.similarity ||
              bestMatch.score ||
              bestMatch.percentage ||
              null;
          }

          if (track.versions.length > 0) {
            variationsText = track.versions
              .map(
                (v) =>
                  `${v.title || v.originalSeratoTitle || "Unknown Title"} - ${
                    v.artist || v.originalSeratoArtist || "Unknown Artist"
                  }`
              )
              .join("<br>");
          } else {
            variationsText = "-";
          }
        } else {
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

          if (similarityPercentage === null) {
            similarityPercentage =
              track.similarity || track.score || track.percentage || null;
          }

          if (seratoTrackName !== "Not found") {
            variationsText = `${seratoTrackName} - ${seratoArtistName}`;
          }
        }
      }

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
                    <td class="variations-cell">${variationsText}</td>
                </tr>
            `;
    })
    .join("");
}

// Generate scan track list (reuse from script.js)
function generateScanTrackList(tracks, type) {
  if (!tracks || tracks.length === 0) {
    return `No ${type} tracks to display.`;
  }

  return tracks
    .map((track) => {
      if (type === "found") {
        // For found tracks, show the Serato track name (the matched track)
        let seratoTrackName = "Unknown Title";
        let seratoArtistName = "Unknown Artist";

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
          seratoTrackName =
            track.seratoTitle ||
            track.originalSeratoTitle ||
            track.matchedTitle ||
            "Unknown Title";
          seratoArtistName =
            track.seratoArtist ||
            track.originalSeratoArtist ||
            track.matchedArtist ||
            "Unknown Artist";
        }

        return `${seratoTrackName} - ${seratoArtistName}`;
      } else {
        // For missing tracks, show the Spotify track name
        const spotifyTrackName = track.name || track.title || "Unknown Track";
        const spotifyArtistName = track.artist || "Unknown Artist";
        return `${spotifyTrackName} - ${spotifyArtistName}`;
      }
    })
    .join("<br>");
}

// Get percentage class (reuse from script.js)
function getPercentageClass(percentage) {
  if (percentage === null || percentage === undefined) return "na";
  if (percentage >= 90) return "excellent";
  if (percentage >= 80) return "good";
  if (percentage >= 70) return "fair";
  return "poor";
}

// Show variations popup (reuse from script.js)
function showVariations(trackName, versions) {
  if (!versions || versions.length === 0) return;

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
                      version.title ||
                      version.originalSeratoTitle ||
                      "Unknown Title";
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

  popup.onclick = (e) => {
    if (e.target === popup) {
      popup.remove();
    }
  };

  document.body.appendChild(popup);
}

// Show error
function showError(message) {
  if (errorMessage) {
    errorMessage.textContent = message;
  }
  if (errorModal) {
    errorModal.style.display = "flex";
  }
}

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
  initializeDOMElements();
  setupEventListeners();
  checkAuth();
});
