import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function AuthLoading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "55vh",
        gap: "1rem",
        color: "var(--text, #1e293b)",
        fontFamily: "inherit",
      }}
    >
      <div
        className="auth-spinner"
        style={{
          width: 38,
          height: 38,
          border: "3px solid #e2e8f0",
          borderTopColor: "var(--accent, #2563eb)",
          borderRadius: "50%",
          animation: "authSpin 0.75s linear infinite",
        }}
      />
      <p style={{ margin: 0, fontSize: "0.95rem", color: "#64748b" }}>
        Verifying secure session...
      </p>
      <style>{`
        @keyframes authSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Reusable ProtectedRoute component
 * 
 * - Shows AuthLoading while checking authentication with backend /users/me
 * - Redirects unauthenticated users to /login, preserving their intended URL in location.state
 * - Renders children or nested Route Outlet when authenticated
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AuthLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? children : <Outlet />;
}

