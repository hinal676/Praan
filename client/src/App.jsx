import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AuthScreen from "./components/AuthScreen.jsx";
import Loader from "./components/Loader.jsx";
import ShellLayout from "./components/ShellLayout.jsx";
import DiscoverPage from "./pages/Discover.jsx";
import HomePage from "./pages/Home.jsx";
import ProfilePage from "./pages/Profile.jsx";
import { authService } from "./services/authService.js";

const AUTH_TOKEN_KEY = "authToken";

export default function App() {
  const [authStatus, setAuthStatus] = useState("loading");
  const [currentUser, setCurrentUser] = useState(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    if (!token) {
      setAuthStatus("unauthenticated");
      return;
    }

    let isActive = true;

    authService
      .getCurrentUser(token)
      .then((user) => {
        if (!isActive) return;
        setCurrentUser(user);
        setAuthStatus("authenticated");
      })
      .catch(() => {
        if (!isActive) return;
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setCurrentUser(null);
        setAuthStatus("unauthenticated");
      });

    return () => {
      isActive = false;
    };
  }, []);

  const handleAuthSuccess = async (authResponse) => {
    localStorage.setItem(AUTH_TOKEN_KEY, authResponse.token);
    const user = await authService.getCurrentUser(authResponse.token);
    setCurrentUser(user);
    setAuthStatus("authenticated");
  };

  const handleLogin = async (credentials) => {
    const response = await authService.login(credentials);
    await handleAuthSuccess(response);
  };

  const handleSignup = async (credentials) => {
    const response = await authService.register(credentials);
    await handleAuthSuccess(response);
  };

  const handleLogout = async () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    try {
      if (token) {
        await authService.logout(token);
      }
    } catch {
      // Logout should still clear local session even if the server call fails.
    }

    localStorage.removeItem(AUTH_TOKEN_KEY);
    setCurrentUser(null);
    setAuthStatus("unauthenticated");
  };

  if (authStatus === "loading") {
    return <Loader />;
  }

  if (authStatus === "unauthenticated") {
    return (
      <AuthScreen
        onLogin={handleLogin}
        onSignup={handleSignup}
        isSubmitting={authSubmitting}
        setIsSubmitting={setAuthSubmitting}
      />
    );
  }

  const authToken = localStorage.getItem(AUTH_TOKEN_KEY);

  return (
    <ShellLayout user={currentUser} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<HomePage token={authToken} />} />
        <Route path="/discover" element={<DiscoverPage token={authToken} />} />
        <Route
          path="/profile"
          element={
            <ProfilePage
              user={currentUser}
              token={authToken}
              onUserChange={setCurrentUser}
              onLogout={handleLogout}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ShellLayout>
  );
}
