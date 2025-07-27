// Global state
let currentUser = null;
let authToken = null;
let stripe = null;
let elements = null;

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
const paymentModal = document.getElementById("payment-modal");
const paymentModalClose = document.getElementById("payment-modal-close");
const selectedPlanInfo = document.getElementById("selected-plan-info");
const paymentForm = document.getElementById("payment-form");
const successModal = document.getElementById("success-modal");
const successModalClose = document.getElementById("success-modal-close");
const successContinueBtn = document.getElementById("success-continue-btn");

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

// Update user interface
function updateUserInterface(data) {
  if (data.user) {
    userEmail.textContent = data.user.email;

    // Update subscription status
    if (data.user.role === "premium") {
      subscriptionStatus.textContent = "PRO";
      subscriptionStatus.className = "subscription-status active";
    } else if (data.user.role === "trial") {
      subscriptionStatus.textContent = "TRIAL";
      subscriptionStatus.className = "subscription-status trial";
    } else {
      subscriptionStatus.textContent = "FREE";
      subscriptionStatus.className = "subscription-status free";
    }

    userInfo.style.display = "flex";
  }
}

// Setup event listeners
function setupEventListeners() {
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
  if (paymentModalClose) {
    paymentModalClose.addEventListener("click", closePaymentModal);
  }
  if (successModalClose) {
    successModalClose.addEventListener("click", closeSuccessModal);
  }
  if (successContinueBtn) {
    successContinueBtn.addEventListener("click", () => {
      window.location.href = "/";
    });
  }

  // Close modals when clicking outside
  if (paymentModal) {
    paymentModal.addEventListener("click", (e) => {
      if (e.target === paymentModal) {
        closePaymentModal();
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
async function handleUpgradeClick(planType) {
  if (!currentUser) {
    alert("Please log in to upgrade your account.");
    return;
  }

  // Show payment modal
  showPaymentModal(planType);
}

// Show payment modal
async function showPaymentModal(planType) {
  // Update selected plan info
  const planInfo = getPlanInfo(planType);
  selectedPlanInfo.innerHTML = `
    <h4>${planInfo.name} Plan</h4>
    <p class="plan-price-display">${planInfo.price}</p>
    <p class="plan-description">${planInfo.description}</p>
  `;

  // Show modal
  paymentModal.style.display = "flex";

  // Initialize Stripe
  await initializeStripe(planType);
}

// Get plan information
function getPlanInfo(planType) {
  const plans = {
    monthly: {
      name: "Monthly",
      price: "£2.99/month",
      description: "Perfect for occasional use",
      priceId: "price_monthly", // You'll need to set up these price IDs in Stripe
    },
    yearly: {
      name: "Yearly",
      price: "£24.99/year",
      description: "Save 30% with annual billing",
      priceId: "price_yearly",
    },
    lifetime: {
      name: "Lifetime",
      price: "£34.99",
      description: "One-time payment, lifetime access",
      priceId: "price_lifetime",
    },
  };

  return plans[planType];
}

// Initialize Stripe
async function initializeStripe(planType) {
  try {
    // Get Stripe publishable key from server
    const response = await fetch("/api/stripe/config", {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to get Stripe configuration");
    }

    const { publishableKey } = await response.json();

    // Load Stripe.js
    if (!window.Stripe) {
      const script = document.createElement("script");
      script.src = "https://js.stripe.com/v3/";
      script.onload = () => setupStripeElements(publishableKey, planType);
      document.head.appendChild(script);
    } else {
      setupStripeElements(publishableKey, planType);
    }
  } catch (error) {
    console.error("Error initializing Stripe:", error);
    showError("Failed to initialize payment system. Please try again.");
  }
}

// Setup Stripe elements
function setupStripeElements(publishableKey, planType) {
  stripe = Stripe(publishableKey);

  // Create payment element
  const options = {
    mode: "subscription",
    amount: getPlanAmount(planType),
    currency: "gbp",
    appearance: {
      theme: "night",
      variables: {
        colorPrimary: "#3b82f6",
        colorBackground: "#1e293b",
        colorText: "#f8fafc",
        colorDanger: "#ef4444",
        fontFamily: "Inter, system-ui, sans-serif",
        spacingUnit: "4px",
        borderRadius: "8px",
      },
    },
  };

  elements = stripe.elements(options);
  const paymentElement = elements.create("payment");
  paymentElement.mount("#payment-form");

  // Add submit button
  const submitButton = document.createElement("button");
  submitButton.textContent = "Complete Purchase";
  submitButton.className = "primary-btn";
  submitButton.style.width = "100%";
  submitButton.style.marginTop = "1rem";
  submitButton.onclick = (e) => handlePaymentSubmit(e, planType);

  paymentForm.appendChild(submitButton);
}

// Get plan amount in pence
function getPlanAmount(planType) {
  const amounts = {
    monthly: 299, // £2.99 in pence
    yearly: 2499, // £24.99 in pence
    lifetime: 3499, // £34.99 in pence
  };
  return amounts[planType];
}

// Handle payment submission
async function handlePaymentSubmit(event, planType) {
  event.preventDefault();

  if (!stripe || !elements) {
    showError("Payment system not initialized. Please refresh the page.");
    return;
  }

  const submitButton = event.target;
  submitButton.disabled = true;
  submitButton.textContent = "Processing...";

  try {
    // Create payment intent on server
    const response = await fetch("/api/stripe/create-payment-intent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        planType: planType,
        amount: getPlanAmount(planType),
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create payment intent");
    }

    const { clientSecret } = await response.json();

    // Confirm payment with Stripe
    const { error } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/pricing.html?success=true`,
      },
    });

    if (error) {
      throw error;
    }

    // Payment successful
    closePaymentModal();
    showSuccessModal();
  } catch (error) {
    console.error("Payment error:", error);
    showError(error.message || "Payment failed. Please try again.");
    submitButton.disabled = false;
    submitButton.textContent = "Complete Purchase";
  }
}

// Close payment modal
function closePaymentModal() {
  paymentModal.style.display = "none";
  // Clear payment form
  if (paymentForm) {
    paymentForm.innerHTML = "";
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
}

// Show error message
function showError(message) {
  alert(message); // You can replace this with a better error display
}

// Check for success parameter in URL
function checkForSuccess() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("success") === "true") {
    showSuccessModal();
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
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
  setupEventListeners();
  checkForSuccess();
});
