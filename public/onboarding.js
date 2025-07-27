// Global state
let currentUser = null;
let authToken = null;

// DOM elements
const uploadSection = document.getElementById("upload-section");
const databaseFile = document.getElementById("databaseFile");
const uploadBtn = document.getElementById("uploadBtn");
const uploadStatus = document.getElementById("uploadStatus");
const continueBtn = document.getElementById("continueBtn");

// Check authentication on page load
async function checkAuth() {
  const token = localStorage.getItem("authToken");
  if (!token) {
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
    } else {
      // Token is invalid
      localStorage.removeItem("authToken");
      window.location.href = "/auth.html";
    }
  } catch (error) {
    console.error("Auth check error:", error);
    localStorage.removeItem("authToken");
    window.location.href = "/auth.html";
  }
}

// Setup drag and drop
function setupDragAndDrop() {
  uploadSection.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadSection.classList.add("dragover");
  });

  uploadSection.addEventListener("dragleave", (e) => {
    e.preventDefault();
    uploadSection.classList.remove("dragover");
  });

  uploadSection.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadSection.classList.remove("dragover");

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  uploadSection.addEventListener("click", () => {
    databaseFile.click();
  });

  databaseFile.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });

  uploadBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    databaseFile.click();
  });
}

// Handle file upload
async function handleFileUpload(file) {
  if (!isValidDatabaseFile(file)) {
    showUploadStatus("Please select a valid database file.", "error");
    return;
  }

  try {
    showUploadStatus("Uploading database file...", "loading");
    uploadBtn.disabled = true;

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
      showUploadStatus(
        "✅ Database uploaded successfully! You can now continue.",
        "success"
      );
      continueBtn.style.display = "inline-block";
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
    console.error("Upload error:", error);
    showUploadStatus("Upload failed. Please try again.", "error");
  } finally {
    uploadBtn.disabled = false;
  }
}

// Validate database file
function isValidDatabaseFile(file) {
  // Accept any file type since database V2 files don't have extensions
  return file && file.size > 0;
}

// Show upload status
function showUploadStatus(message, type) {
  uploadStatus.textContent = message;
  uploadStatus.className = `upload-status ${type}`;
  uploadStatus.style.display = "block";
}

// Continue to main app
continueBtn.addEventListener("click", () => {
  window.location.href = "/";
});

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  checkAuth();
  setupDragAndDrop();
});
