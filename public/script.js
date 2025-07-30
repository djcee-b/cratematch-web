// Simple Spotify Playlist to Serato Crate Converter
let authToken = localStorage.getItem("authToken");

// Simple authentication check
async function checkAuth() {
  try {
    if (!authToken) {
      window.location.href = "/auth.html";
      return;
    }

    const response = await fetch("/auth/me", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      localStorage.removeItem("authToken");
      window.location.href = "/auth.html";
      return;
    }

    const userData = await response.json();
    updateUserInterface(userData);
    hideLoadingOverlay();
  } catch (error) {
    console.error("Auth check error:", error);
    localStorage.removeItem("authToken");
    window.location.href = "/auth.html";
  }
}

// Update user interface
function updateUserInterface(userData) {
  const userInfo = document.getElementById("user-info");
  const userEmail = document.getElementById("user-email");
  const subscriptionStatus = document.getElementById("subscription-status");

  if (userInfo && userEmail && subscriptionStatus) {
    userInfo.style.display = "flex";
    userEmail.textContent = userData.user.email || "Unknown";
    subscriptionStatus.textContent = userData.subscriptionStatus || "Unknown";
  }
}

// Hide loading overlay
function hideLoadingOverlay() {
  const loadingOverlay = document.getElementById("loading-overlay");
  if (loadingOverlay) {
    loadingOverlay.classList.add("hidden");
  }
}

// Show processing overlay
function showProcessingOverlay() {
  const processingOverlay = document.getElementById("processing-overlay");
  if (processingOverlay) {
    processingOverlay.classList.add("show");
  }
}

// Hide processing overlay
function hideProcessingOverlay() {
  const processingOverlay = document.getElementById("processing-overlay");
  if (processingOverlay) {
    processingOverlay.classList.remove("show");
  }
}

// Update processing status
function updateProcessingStatus(message) {
  const processingStatus = document.getElementById("processing-status");
  if (processingStatus) {
    processingStatus.textContent = message;
  }
}

// Show error modal
function showErrorModal(message) {
  const errorModal = document.getElementById("error-modal");
  const errorMessage = document.getElementById("error-message");
  if (errorModal && errorMessage) {
    errorMessage.textContent = message;
    errorModal.classList.add("show");
  }
}

// Hide error modal
function hideErrorModal() {
  const errorModal = document.getElementById("error-modal");
  if (errorModal) {
    errorModal.classList.remove("show");
  }
}

// Simple playlist processing
async function processPlaylist() {
  const playlistUrl = document.getElementById("playlist-url").value.trim();
  const threshold = document.getElementById("threshold").value;
  const processBtn = document.getElementById("process-btn");

  if (!playlistUrl) {
    showErrorModal("Please enter a Spotify playlist URL");
    return;
  }

  if (!playlistUrl.includes("open.spotify.com/playlist/")) {
    showErrorModal("Please enter a valid Spotify playlist URL");
    return;
  }

  try {
    // Disable button and show processing
    if (processBtn) {
      processBtn.disabled = true;
      processBtn.textContent = "Processing...";
    }

    showProcessingOverlay();
    updateProcessingStatus("Loading your playlist...");

    const response = await fetch("/process-playlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        playlistUrl,
        threshold: parseInt(threshold),
        databaseFileName: "database-v2",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    updateProcessingStatus("Processing tracks...");
    const result = await response.json();

    hideProcessingOverlay();
    showResults(result);
  } catch (error) {
    console.error("Processing error:", error);
    hideProcessingOverlay();

    if (error.message && error.message.includes("Database not found")) {
      showErrorModal(
        "Please upload a database file first. Go to Settings to upload your Serato database."
      );
    } else {
      showErrorModal(`Processing failed: ${error.message}`);
    }
  } finally {
    // Re-enable button
    if (processBtn) {
      processBtn.disabled = false;
      processBtn.textContent = "Process Playlist";
    }
  }
}

// Show results
function showResults(result) {
  // Store results globally for modal access
  window.currentResults = result;
  const resultsSection = document.getElementById("results-section");
  const resultsSummary = document.getElementById("results-summary");
  const downloadSection = document.getElementById("download-section");
  const inputSection = document.getElementById("input-section");

  if (!resultsSection || !resultsSummary) {
    console.error("Results elements not found");
    return;
  }

  // Hide input section and show results section
  if (inputSection) {
    inputSection.style.display = "none";
  }
  resultsSection.classList.add("show");

  // Scroll to results section
  setTimeout(() => {
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);

  // Update summary
  resultsSummary.innerHTML = `
    <div class="summary-card">
      <div class="summary-number">${result.results.totalTracks}</div>
      <div class="summary-label">Total Tracks</div>
    </div>
    <div class="summary-card">
      <div class="summary-number">${result.results.foundTracks}</div>
      <div class="summary-label">Found Tracks</div>
    </div>
    <div class="summary-card">
      <div class="summary-number">${result.results.missingTracks}</div>
      <div class="summary-label">Missing Tracks</div>
    </div>
  `;

  // Update toggle button counts
  const foundTracksCount = document.getElementById("found-tracks-count");
  const missingTracksCount = document.getElementById("missing-tracks-count");

  if (foundTracksCount) {
    foundTracksCount.textContent = `(${result.results.foundTracks})`;
  }
  if (missingTracksCount) {
    missingTracksCount.textContent = `(${result.results.missingTracks})`;
  }



  // Show download section if crate was created
  if (result.hasCrateFile && downloadSection) {
    downloadSection.style.display = "block";
    const downloadBtn = document.getElementById("download-btn");
    if (downloadBtn) {
      downloadBtn.onclick = () =>
        downloadCrate(result.downloadUrl, result.results.playlistName);
    }
  } else if (downloadSection) {
    downloadSection.style.display = "none";
  }
}

// Simple download function
async function downloadCrate(downloadUrl, playlistName) {
  try {
    const response = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    // Create filename from playlist name
    const safePlaylistName = playlistName
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim();
    const filename = safePlaylistName
      ? `${safePlaylistName}.crate`
      : "crate.crate";
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error("Download error:", error);
    showErrorModal(`Download failed: ${error.message}`);
  }
}

// Show track list modal
function showTrackModal(type, tracks) {
  const modal = document.getElementById("track-modal");
  const modalTitle = document.getElementById("track-modal-title");
  const tableBody = document.getElementById("track-table-body");
  const listText = document.getElementById("track-list-text");

  if (modal && modalTitle) {
    // Set modal title
    modalTitle.textContent = `${
      type === "found" ? "Found" : "Missing"
    } Tracks (${tracks.length})`;

    // Populate table view
    if (tableBody) {
      tableBody.innerHTML = "";
      tracks.forEach((track) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${track.title}</td>
          <td>${track.artist}</td>
        `;
        tableBody.appendChild(row);
      });
    }

    // Populate list view
    if (listText) {
      listText.innerHTML = tracks
        .map((track) => `${track.title} - ${track.artist}`)
        .join(",<br>");
    }

    // Show modal
    modal.classList.add("show");
  }
}

// Reset form and hide results
function resetForm() {
  const resultsSection = document.getElementById("results-section");
  const downloadSection = document.getElementById("download-section");
  const inputSection = document.getElementById("input-section");
  const playlistUrl = document.getElementById("playlist-url");
  const threshold = document.getElementById("threshold");
  const processBtn = document.getElementById("process-btn");

  // Show input section and hide results sections
  if (inputSection) {
    inputSection.style.display = "block";
  }
  if (resultsSection) {
    resultsSection.classList.remove("show");
  }
  if (downloadSection) {
    downloadSection.style.display = "none";
  }

  // Reset form
  if (playlistUrl) {
    playlistUrl.value = "";
  }
  if (threshold) {
    threshold.value = "90";
    const thresholdValue = document.getElementById("threshold-value");
    if (thresholdValue) {
      thresholdValue.textContent = "90%";
    }
  }

  // Re-enable process button
  if (processBtn) {
    processBtn.disabled = false;
    processBtn.textContent = "Process Playlist";
  }
}

// Simple sign out
function signOut() {
  localStorage.removeItem("authToken");
  window.location.href = "/auth.html";
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", async () => {
  // Set up threshold slider
  const thresholdSlider = document.getElementById("threshold");
  const thresholdValue = document.getElementById("threshold-value");

  if (thresholdSlider && thresholdValue) {
    thresholdSlider.addEventListener("input", function () {
      thresholdValue.textContent = this.value + "%";
    });
  }

  // Set up process button
  const processBtn = document.getElementById("process-btn");
  if (processBtn) {
    processBtn.addEventListener("click", processPlaylist);
  }

  // Set up sign out button
  const signOutBtn = document.getElementById("sign-out-btn");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", signOut);
  }

  // Set up error modal close button
  const errorClose = document.getElementById("error-close");
  if (errorClose) {
    errorClose.addEventListener("click", hideErrorModal);
  }

  // Set up import another playlist button
  const importAnotherBtn = document.getElementById("import-another-btn");
  if (importAnotherBtn) {
    importAnotherBtn.addEventListener("click", resetForm);
  }

  // Set up track list modal buttons
  const foundTracksToggle = document.getElementById("found-tracks-toggle");
  const missingTracksToggle = document.getElementById("missing-tracks-toggle");

  if (foundTracksToggle) {
    foundTracksToggle.addEventListener("click", () => {
      const tracks = window.currentResults?.results?.foundTracksList || [];
      showTrackModal("found", tracks);
    });
  }
  if (missingTracksToggle) {
    missingTracksToggle.addEventListener("click", () => {
      const tracks = window.currentResults?.results?.missingTracksList || [];
      showTrackModal("missing", tracks);
    });
  }

  // Set up track modal controls
  const trackModal = document.getElementById("track-modal");
  const trackModalClose = document.getElementById("track-modal-close");
  const tableViewBtn = document.getElementById("table-view-btn");
  const listViewBtn = document.getElementById("list-view-btn");
  const tableView = document.getElementById("track-table-view");
  const listView = document.getElementById("track-list-view");

  if (trackModalClose) {
    trackModalClose.addEventListener("click", () => {
      trackModal.classList.remove("show");
    });
  }

  if (trackModal) {
    trackModal.addEventListener("click", (e) => {
      if (e.target === trackModal) {
        trackModal.classList.remove("show");
      }
    });
  }

  if (tableViewBtn && listViewBtn && tableView && listView) {
    tableViewBtn.addEventListener("click", () => {
      tableViewBtn.classList.add("active");
      listViewBtn.classList.remove("active");
      tableView.style.display = "block";
      listView.style.display = "none";
    });

    listViewBtn.addEventListener("click", () => {
      listViewBtn.classList.add("active");
      tableViewBtn.classList.remove("active");
      listView.style.display = "block";
      tableView.style.display = "none";
    });
  }

  // Check authentication
  await checkAuth();
});
