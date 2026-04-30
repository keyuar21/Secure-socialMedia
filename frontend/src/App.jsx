import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import VerifyOTP from './pages/VerifyOTP';
import ResetPassword from './pages/ResetPassword';
import Feed from './pages/Feed';
import Profile from './pages/Profile';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      // Ensure userId is always available in localStorage for social features
      if (!localStorage.getItem('userId')) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload?.id) localStorage.setItem('userId', String(payload.id));
        } catch { /* invalid token will be caught by auth middleware */ }
      }
    }
  }, []);

  return (
    <Router>
      <Routes>
        {/* Auth routes */}
        <Route path="/register" element={<Register />} />
        <Route path="/verify-registration" element={<VerifyOTP type="registration" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify-login" element={<VerifyOTP type="login" setIsAuthenticated={setIsAuthenticated} />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected routes */}
        <Route
          path="/feed"
          element={isAuthenticated ? <Feed setIsAuthenticated={setIsAuthenticated} /> : <Navigate to="/login" />}
        />
        <Route
          path="/dashboard"
          element={isAuthenticated ? <Dashboard setIsAuthenticated={setIsAuthenticated} /> : <Navigate to="/login" />}
        />
        <Route
          path="/profile"
          element={isAuthenticated ? <Profile setIsAuthenticated={setIsAuthenticated} /> : <Navigate to="/login" />}
        />
        <Route
          path="/profile/:userId"
          element={isAuthenticated ? <Profile setIsAuthenticated={setIsAuthenticated} /> : <Navigate to="/login" />}
        />

        {/* Default route: feed for authenticated users, login for others */}
        <Route path="/" element={<Navigate to={isAuthenticated ? "/feed" : "/login"} />} />
      </Routes>
    </Router>
  );
};

export default App;
