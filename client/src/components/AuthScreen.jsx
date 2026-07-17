import React, { useState } from "react";

const initialFormState = {
  login: {
    email: "",
    password: "",
  },
  signup: {
    name: "",
    email: "",
    password: "",
  },
};

export default function AuthScreen({
  onLogin,
  onSignup,
  isSubmitting,
  setIsSubmitting,
}) {
  const [activeTab, setActiveTab] = useState("login");
  const [formData, setFormData] = useState(initialFormState);
  const [formError, setFormError] = useState("");

  const panelTitle =
    activeTab === "signup" ? "Create your account" : "Welcome back";
  const panelCopy =
    activeTab === "signup"
      ? "Start generating recipes tailored to you in seconds."
      : "Sign in to access your personalized recipes.";

  const updateField = (section, field, value) => {
    setFormData((previous) => ({
      ...previous,
      [section]: {
        ...previous[section],
        [field]: value,
      },
    }));
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    setFormError("");
    setIsSubmitting?.(true);

    try {
      if (activeTab === "signup") {
        await onSignup(formData.signup);
      } else {
        await onLogin(formData.login);
      }
    } catch (error) {
      setFormError(error?.message || "Authentication failed");
    } finally {
      setIsSubmitting?.(false);
    }
  };

  return (
    <div className="modal auth-screen">
      <div className="modal-content auth-modal">
        <section className="auth-hero">
          <div className="auth-brand">
            <span className="auth-brand-icon" aria-hidden="true">
              🍃
            </span>
            <div className="auth-brand-name">Praan</div>
          </div>
          <h1>Your Health, Your Recipes, Your Way.</h1>
          <p>
            Tailored healthy recipes based on what you eat, avoid, and need.
          </p>
          <ul className="auth-benefits">
            <li>Personalized recipes in seconds</li>
            <li>Nutrition-aware recommendations</li>
            <li>Step-by-step video guidance</li>
          </ul>
        </section>

        <section className="auth-panel">
          <h2>{panelTitle}</h2>
          <p className="auth-panel-copy">{panelCopy}</p>

          <div className="auth-tabs" role="tablist" aria-label="Authentication">
            <button
              className={`auth-tab ${activeTab === "login" ? "active" : ""}`}
              type="button"
              onClick={() => {
                setActiveTab("login");
                setFormError("");
              }}
            >
              Login
            </button>
            <button
              className={`auth-tab ${activeTab === "signup" ? "active" : ""}`}
              type="button"
              onClick={() => {
                setActiveTab("signup");
                setFormError("");
              }}
            >
              Create account
            </button>
          </div>

          <form className="auth-form active" onSubmit={submitAuth}>
            {activeTab === "signup" ? (
              <>
                <div className="form-group">
                  <label htmlFor="signupName">Full Name</label>
                  <input
                    type="text"
                    id="signupName"
                    placeholder="Enter your full name"
                    value={formData.signup.name}
                    onChange={(event) =>
                      updateField("signup", "name", event.target.value)
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="signupEmail">Email</label>
                  <input
                    type="email"
                    id="signupEmail"
                    placeholder="Enter your email"
                    value={formData.signup.email}
                    onChange={(event) =>
                      updateField("signup", "email", event.target.value)
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="signupPassword">Password</label>
                  <input
                    type="password"
                    id="signupPassword"
                    placeholder="Create a password"
                    value={formData.signup.password}
                    onChange={(event) =>
                      updateField("signup", "password", event.target.value)
                    }
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label htmlFor="loginEmail">Email</label>
                  <input
                    type="email"
                    id="loginEmail"
                    placeholder="Enter your email"
                    value={formData.login.email}
                    onChange={(event) =>
                      updateField("login", "email", event.target.value)
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="loginPassword">Password</label>
                  <input
                    type="password"
                    id="loginPassword"
                    placeholder="Enter your password"
                    value={formData.login.password}
                    onChange={(event) =>
                      updateField("login", "password", event.target.value)
                    }
                    required
                  />
                </div>
              </>
            )}

            <p className="auth-error" aria-live="polite">
              {formError}
            </p>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Please wait..."
                : activeTab === "signup"
                  ? "Create Account"
                  : "Sign In"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
