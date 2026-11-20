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

// Only Shop Owners (role === 1) and Super Admins (role === 2) may access admin/owner pages
export function AdminRoute() {
  const { user, isAuthenticated, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AuthLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const role = Number(user?.role);
  if (role !== 1 && role !== 2 && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
