import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { count } = useCart();

  return (
    <header className="topbar">
      <Link to="/" className="logo">Bluetail</Link>

      <nav className="topbar-right">
        <NavLink to="/" end className="nav-link">Shop</NavLink>
        <NavLink to="/cart" className="nav-link">
          Cart{count > 0 && <span className="badge">{count}</span>}
        </NavLink>

        {isAuthenticated ? (
          <>
            <NavLink to="/orders" className="nav-link">My orders</NavLink>
            
            {/* Show "Add product" ONLY for Admin users (role === 1) */}
            {user?.role === 1 && (
              <NavLink to="/admin/add-product" className="nav-link">Add product</NavLink>
            )}

            <Link to="/account" className="who nav-account" title="My Account">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.username} className="nav-avatar" />
              ) : (
                <span className="nav-avatar-fallback">
                  {user?.username?.charAt(0)?.toUpperCase() || "U"}
                </span>
              )}
              <span className="nav-username">{user?.username}</span>
            </Link>
            <button className="ghost" onClick={logout}>Log out</button>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-link">Log in</Link>
            <Link to="/register" className="ghost link-btn">Sign up</Link>
          </>
        )}
      </nav>
    </header>
  );
}
