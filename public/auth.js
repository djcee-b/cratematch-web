// Authentication state
let currentUser = null;
let authToken = null;

// DOM elements
const authLoadingOverlay = document.getElementById("auth-loading-overlay");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const forgotForm = document.getElementById("forgot-form");

const showSignupBtn = document.getElementById("show-signup-btn");
const showLoginBtn = document.getElementById("show-login-btn");
const forgotPasswordBtn = document.getElementById("forgot-password-btn");
const backToLoginBtn = document.getElementById("back-to-login");

// Error/success message elements
const loginError = document.getElementById("login-error");
const signupError = document.getElementById("signup-error");
const signupSuccess = document.getElementById("signup-success");
const forgotError = document.getElementById("forgot-error");
const forgotSuccess = document.getElementById("forgot-success");

// Check if user is already authenticated
async function checkAuthStatus() {
  const token = localStorage.getItem("authToken");
  if (token) {
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

        // Redirect to main app
        window.location.href = "/app";
        return;
      } else {
        // Token is invalid, clear it
        localStorage.removeItem("authToken");
      }
    } catch (error) {
      console.error("Auth check error:", error);
      localStorage.removeItem("authToken");
    }
  }

  // Hide loading overlay after auth check
  hideAuthLoadingOverlay();
}

// Hide auth loading overlay with smooth transition
function hideAuthLoadingOverlay() {
  if (authLoadingOverlay) {
    authLoadingOverlay.classList.add("hidden");
    setTimeout(() => {
      authLoadingOverlay.style.display = "none";
    }, 300);
  }
}

// Show/hide forms
function showForm(formToShow) {
  [loginForm, signupForm, forgotForm].forEach((form) => {
    form.classList.add("hidden");
  });
  formToShow.classList.remove("hidden");

  // Show trial badge only for signup
  const authCard = document.querySelector(".auth-card");
  if (formToShow === signupForm) {
    authCard.classList.add("signup-active");
  } else {
    authCard.classList.remove("signup-active");
  }
}

// Clear error messages
function clearMessages() {
  [loginError, signupError, signupSuccess, forgotError, forgotSuccess].forEach(
    (el) => {
      if (el) el.style.display = "none";
    }
  );
}

// Show error message
function showError(element, message) {
  element.textContent = message;
  element.style.display = "block";
}

// Show success message
function showSuccess(element, message) {
  element.textContent = message;
  element.style.display = "block";
}

// Set loading state
function setLoading(button, isLoading) {
  const btnText = button.querySelector(".btn-text");
  const btnLoading = button.querySelector(".btn-loading");

  if (isLoading) {
    if (btnText) btnText.classList.add("hidden");
    if (btnLoading) btnLoading.classList.remove("hidden");
    button.disabled = true;
  } else {
    if (btnText) btnText.classList.remove("hidden");
    if (btnLoading) btnLoading.classList.add("hidden");
    button.disabled = false;
  }
}

// Handle sign in
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessages();

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  const submitBtn = loginForm.querySelector('button[type="submit"]');

  if (!email || !password) {
    showError(loginError, "Please fill in all fields");
    return;
  }

  setLoading(submitBtn, true);

  try {
    const response = await fetch("/auth/signin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      // Store token and user data
      localStorage.setItem("authToken", data.session.access_token);
      currentUser = data.user;
      authToken = data.session.access_token;

      // Redirect to main app
      window.location.href = "/app";
    } else {
      showError(loginError, data.message || "Sign in failed");
    }
  } catch (error) {
    console.error("Sign in error:", error);
    showError(loginError, "Network error. Please try again.");
  } finally {
    setLoading(submitBtn, false);
  }
});

// Handle sign up
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessages();

  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  const confirmPassword = document.getElementById(
    "signup-confirm-password"
  ).value;
  const submitBtn = signupForm.querySelector('button[type="submit"]');

  if (!email || !password || !confirmPassword) {
    showError(signupError, "Please fill in all fields");
    return;
  }

  if (password !== confirmPassword) {
    showError(signupError, "Passwords do not match");
    return;
  }

  if (password.length < 6) {
    showError(signupError, "Password must be at least 6 characters long");
    return;
  }

  setLoading(submitBtn, true);

  try {
    const response = await fetch("/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      // Store the session token if available
      if (data.session && data.session.access_token) {
        localStorage.setItem("authToken", data.session.access_token);

        showSuccess(signupSuccess, data.message);

        // Redirect to onboarding after a short delay
        setTimeout(() => {
          window.location.href = "/onboarding";
        }, 1500);
      } else {
        // Email confirmation required
        showSuccess(signupSuccess, data.message);
        // Don't redirect - let user check email and sign in manually
      }
    } else {
      showError(signupError, data.message || "Sign up failed");
    }
  } catch (error) {
    console.error("Sign up error:", error);
    showError(signupError, "Network error. Please try again.");
  } finally {
    setLoading(submitBtn, false);
  }
});

// Handle password reset
forgotForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessages();

  const email = document.getElementById("forgot-email").value;
  const submitBtn = forgotForm.querySelector('button[type="submit"]');

  if (!email) {
    showError(forgotError, "Please enter your email address");
    return;
  }

  setLoading(submitBtn, true);

  try {
    const response = await fetch("/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (response.ok) {
      showSuccess(forgotSuccess, data.message);
      // Clear form
      forgotForm.reset();
    } else {
      showError(forgotError, data.message || "Password reset failed");
    }
  } catch (error) {
    console.error("Password reset error:", error);
    showError(forgotError, "Network error. Please try again.");
  } finally {
    setLoading(submitBtn, false);
  }
});

// Form switching
showSignupBtn.addEventListener("click", () => {
  clearMessages();
  showForm(signupForm);
});

showLoginBtn.addEventListener("click", () => {
  clearMessages();
  showForm(loginForm);
});

forgotPasswordBtn.addEventListener("click", () => {
  clearMessages();
  showForm(forgotForm);
});

backToLoginBtn.addEventListener("click", () => {
  clearMessages();
  showForm(loginForm);
});

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Add a timeout to prevent infinite loading
  setTimeout(() => {
    if (
      authLoadingOverlay &&
      !authLoadingOverlay.classList.contains("hidden")
    ) {
      console.warn("Auth check taking too long, hiding loading overlay");
      hideAuthLoadingOverlay();
    }
  }, 10000); // 10 second timeout

  // Check URL parameters for mode
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get("mode");

  checkAuthStatus().then(() => {
    // After auth check, show appropriate form based on mode
    if (mode === "signup") {
      showForm(signupForm);
    } else if (mode === "signin") {
      showForm(loginForm);
    }
    // If no mode specified, default to login form
  });
});
