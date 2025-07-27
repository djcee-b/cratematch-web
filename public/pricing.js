// Global state
let currentUser = null;
let authToken = null;

// Payment Links Configuration (matching desktop app)
const PAYMENT_LINKS = {
  // Live payment links (production)
  live: {
    monthly: "https://buy.stripe.com/8x2dR938FdTEdGHestdMI0d",
    yearly: "https://buy.stripe.com/5kQdR910xcPA6efbghdMI0h",
    lifetime: "https://buy.stripe.com/4gMdR938FdTE467ckldMI0f",
  },

  // Test payment links (development)
  test: {
    monthly: "https://buy.stripe.com/test_00wcN54cJ5n8cCDdopdMI02",
    yearly: "https://buy.stripe.com/test_eVq00j24BeXIcCDgABdMI03",
    lifetime: "https://buy.stripe.com/test_28E9ATbFb6rc323989dMI04",
  },
};

// Function to get payment links based on environment
function getPaymentLinks(isDevMode = false) {
  return isDevMode ? PAYMENT_LINKS.test : PAYMENT_LINKS.live;
}

// DOM elements
const loadingOverlay = document.getElementById("loading-overlay");
const userInfo = document.getElementById("user-info");
const userEmail = document.getElementById("user-email");
const subscriptionStatus = document.getElementById("subscription-status");
const settingsBtn = document.getElementById("settings-btn");
const signOutBtn = document.getElementById("sign-out-btn");

// Pricing elements
const monthlyBtn = document.getElementById("monthly-plan-btn");
const yearlyBtn = document.getElementById("yearly-plan-btn");
const lifetimeBtn = document.getElementById("lifetime-plan-btn");

// Modal elements
const successModal = document.getElementById("success-modal");
const successModalClose = document.getElementById("success-modal-close");
const successContinueBtn = document.getElementById("success-continue-btn");

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
    authToken = token;

    // Update UI
    updateUserInterface();

    // Check for success parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("success") === "true") {
      showSuccessModal();
    }
  } catch (error) {
    console.error("Auth error:", error);
    localStorage.removeItem("authToken");
    window.location.href = "/auth.html";
  }
}

// Update user interface based on subscription status
function updateUserInterface() {
  if (!currentUser) return;

  // Update user info
  if (userEmail) {
    userEmail.textContent = currentUser.email;
  }

  if (subscriptionStatus) {
    const status = currentUser.role || "free";
    subscriptionStatus.textContent =
      status.charAt(0).toUpperCase() + status.slice(1);

    // Hide pricing page for premium users
    if (status === "premium") {
      window.location.href = "/";
    }
  }

  // Hide loading overlay
  if (loadingOverlay) {
    loadingOverlay.style.display = "none";
  }
}

// Show error message
function showError(message) {
  alert(message); // Simple error display for now
}

// Initialize event listeners
function initializeEventListeners() {
  // Upgrade buttons
  if (monthlyBtn) {
    monthlyBtn.addEventListener("click", () => handleUpgradeClick("monthly"));
  }
  if (yearlyBtn) {
    yearlyBtn.addEventListener("click", () => handleUpgradeClick("yearly"));
  }
  if (lifetimeBtn) {
    lifetimeBtn.addEventListener("click", () => handleUpgradeClick("lifetime"));
  }

  // Modal close buttons
  if (successModalClose) {
    successModalClose.addEventListener("click", closeSuccessModal);
  }
  if (successContinueBtn) {
    successContinueBtn.addEventListener("click", () => {
      window.location.href = "/";
    });
  }

  // Close modals when clicking outside
  if (successModal) {
    successModal.addEventListener("click", (e) => {
      if (e.target === successModal) {
        closeSuccessModal();
      }
    });
  }

  // Sign out button
  if (signOutBtn) {
    signOutBtn.addEventListener("click", handleSignOut);
  }
}

// Handle upgrade button clicks
function handleUpgradeClick(planType) {
  if (!currentUser) {
    alert("Please log in to upgrade your account.");
    return;
  }

  // Determine if we're in dev mode (you can adjust this logic)
  const isDevMode =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  // Get the appropriate payment links
  const paymentLinks = getPaymentLinks(isDevMode);

  // Get the payment link for the selected plan
  const paymentLink = paymentLinks[planType];

  if (!paymentLink) {
    showError("Payment link not available for this plan. Please try again.");
    return;
  }

  // Add the user's email to pre-fill the payment form
  const emailParam = `prefilled_email=${encodeURIComponent(currentUser.email)}`;
  const separator = paymentLink.includes('?') ? '&' : '?';
  const finalPaymentLink = `${paymentLink}${separator}${emailParam}`;

  // Redirect to Stripe payment link with pre-filled email
  window.location.href = finalPaymentLink;
}

// Show success modal
function showSuccessModal() {
  successModal.style.display = "flex";
}

// Close success modal
function closeSuccessModal() {
  successModal.style.display = "none";
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
