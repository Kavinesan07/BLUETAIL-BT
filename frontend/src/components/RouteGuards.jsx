import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ProtectedRoute, { AuthLoading } from "./ProtectedRoute";

export { ProtectedRoute, AuthLoading };

// Only logged-out guests may access login and register pages
export function GuestRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AuthLoading />;
  }

  if (isAuthenticated) {
    const destination = location.state?.from?.pathname || "/";
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
}

// Only administrators (role === 1) may access admin pages (e.g. Add Product)
export function AdminRoute() {
  const { user, isAuthenticated, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AuthLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin && user?.role !== 1) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
