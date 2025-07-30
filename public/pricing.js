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
const backToAppLink = document.getElementById("back-to-app-link");

// Pricing elements
const monthlyBtn = document.getElementById("monthly-plan-btn");
const yearlyBtn = document.getElementById("yearly-plan-btn");
const lifetimeBtn = document.getElementById("lifetime-plan-btn");

// Modal elements
const successModal = document.getElementById("success-modal");
const successModalClose = document.getElementById("success-modal-close");
const successContinueBtn = document.getElementById("success-continue-btn");

// Payment instruction modal elements
const paymentInstructionsModal = document.getElementById(
  "payment-instructions-modal"
);
const paymentInstructionsClose = document.getElementById(
  "payment-instructions-close"
);
const paymentInstructionsCloseBtn = document.getElementById(
  "payment-instructions-close-btn"
);
const proceedToPaymentBtn = document.getElementById("proceed-to-payment-btn");
const paymentEmail = document.getElementById("payment-email");

// Payment completion modal elements
const paymentCompletionModal = document.getElementById(
  "payment-completion-modal"
);
const paymentCompletionClose = document.getElementById(
  "payment-completion-close"
);
const refreshSubscriptionBtn = document.getElementById(
  "refresh-subscription-btn"
);

// Global variables for payment flow
let selectedPlanType = null;
let paymentLink = null;

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

  // Update back to app link for logged in users
  if (backToAppLink) {
    backToAppLink.href = "/app";
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

  // Payment instructions modal
  if (paymentInstructionsClose) {
    paymentInstructionsClose.addEventListener(
      "click",
      closePaymentInstructionsModal
    );
  }
  if (paymentInstructionsCloseBtn) {
    paymentInstructionsCloseBtn.addEventListener(
      "click",
      closePaymentInstructionsModal
    );
  }
  if (proceedToPaymentBtn) {
    proceedToPaymentBtn.addEventListener("click", proceedToPayment);
  }

  // Payment completion modal
  if (paymentCompletionClose) {
    paymentCompletionClose.addEventListener(
      "click",
      closePaymentCompletionModal
    );
  }
  if (refreshSubscriptionBtn) {
    refreshSubscriptionBtn.addEventListener("click", refreshSubscription);
  }

  // Success modal
  if (successModalClose) {
    successModalClose.addEventListener("click", closeSuccessModal);
  }
  if (successContinueBtn) {
    successContinueBtn.addEventListener("click", () => {
      window.location.href = "/";
    });
  }

  // Close modals when clicking outside
  if (paymentInstructionsModal) {
    paymentInstructionsModal.addEventListener("click", (e) => {
      if (e.target === paymentInstructionsModal) {
        closePaymentInstructionsModal();
      }
    });
  }
  if (paymentCompletionModal) {
    paymentCompletionModal.addEventListener("click", (e) => {
      if (e.target === paymentCompletionModal) {
        closePaymentCompletionModal();
      }
    });
  }
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
  const link = paymentLinks[planType];

  if (!link) {
    showError("Payment link not available for this plan. Please try again.");
    return;
  }

  // Store the plan type and payment link for later use
  selectedPlanType = planType;
  paymentLink = link;

  // Show loading state and proceed to payment
  showPaymentLoadingState();

  // Automatically proceed to payment after a short delay
  setTimeout(() => {
    proceedToPayment();
  }, 2000); // 2 second delay to show loading
}

// Show payment instructions modal
function showPaymentInstructionsModal() {
  if (paymentEmail && currentUser) {
    paymentEmail.textContent = currentUser.email;
  }
  paymentInstructionsModal.style.display = "flex";
}

// Show payment loading state
function showPaymentLoadingState() {
  paymentInstructionsModal.style.display = "flex";
  const instructionsContent = document.querySelector(
    ".payment-instructions-content"
  );
  if (instructionsContent) {
    instructionsContent.innerHTML = `
      <div class="payment-loading">
        <div class="payment-spinner"></div>
        <h4>Loading Payment...</h4>
        <p>Preparing your payment link...</p>
        <div class="loading-email-warning">
          <p><strong>IMPORTANT:</strong> Be sure to use <span class="highlight-email">${currentUser.email}</span> as your payment email otherwise your account won't apply. Any issues contact djceeb@gmail.com</p>
        </div>
      </div>
    `;
  }
}

// Close payment instructions modal
function closePaymentInstructionsModal() {
  paymentInstructionsModal.style.display = "none";
  selectedPlanType = null;
  paymentLink = null;
}

// Proceed to payment
function proceedToPayment() {
  if (!paymentLink || !currentUser) {
    showError("Payment link not available. Please try again.");
    return;
  }

  // Add the user's email to pre-fill the payment form
  const emailParam = `prefilled_email=${encodeURIComponent(currentUser.email)}`;
  const separator = paymentLink.includes("?") ? "&" : "?";
  const finalPaymentLink = `${paymentLink}${separator}${emailParam}`;

  // Close the loading modal
  closePaymentInstructionsModal();

  // Show the completion modal
  showPaymentCompletionModal();

  // Open Stripe payment link in new tab
  window.open(finalPaymentLink, "_blank");
}

// Show payment completion modal
function showPaymentCompletionModal() {
  // Set the email in the completion modal
  const completionEmail = document.getElementById("completion-email");
  if (completionEmail && currentUser) {
    completionEmail.textContent = currentUser.email;
  }
  paymentCompletionModal.style.display = "flex";
}

// Close payment completion modal
function closePaymentCompletionModal() {
  paymentCompletionModal.style.display = "none";
}

// Refresh subscription status
async function refreshSubscription() {
  try {
    // Show loading state
    refreshSubscriptionBtn.textContent = "🔄 Checking...";
    refreshSubscriptionBtn.disabled = true;

    // Check user's subscription status
    const response = await fetch("/api/auth/verify", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to check subscription status");
    }

    const userData = await response.json();

    // Update current user data
    currentUser = userData.user;
    currentUser.subscriptionStatus = userData.subscriptionStatus;

    // Check if subscription is now premium
    if (userData.subscriptionStatus === "premium") {
      // Close completion modal and show success modal
      closePaymentCompletionModal();
      showSuccessModal();
    } else {
      // Still not premium, show error
      showError(
        "Payment not detected yet. Please wait a moment and try again, or contact support if you've completed payment."
      );
      refreshSubscriptionBtn.textContent = "🔄 Refresh & Activate";
      refreshSubscriptionBtn.disabled = false;
    }
  } catch (error) {
    console.error("Error refreshing subscription:", error);
    showError("Failed to check subscription status. Please try again.");
    refreshSubscriptionBtn.textContent = "🔄 Refresh & Activate";
    refreshSubscriptionBtn.disabled = false;
  }
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
