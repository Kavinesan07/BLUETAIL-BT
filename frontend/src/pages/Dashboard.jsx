import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const PRESET_AVATARS = [
  { id: "car", label: "🏎️ Racer", emoji: "🏎️", bg: "#e0f2fe", color: "#0369a1" },
  { id: "rocket", label: "🚀 Pilot", emoji: "🚀", bg: "#fef3c7", color: "#b45309" },
  { id: "robot", label: "🤖 Bot", emoji: "🤖", bg: "#ede9fe", color: "#6d28d9" },
  { id: "cat", label: "🐱 Kitty", emoji: "🐱", bg: "#fce7f3", color: "#be185d" },
  { id: "lion", label: "🦁 King", emoji: "🦁", bg: "#ffedd5", color: "#c2410c" },
  { id: "gamer", label: "🎮 Gamer", emoji: "🎮", bg: "#dcfce7", color: "#15803d" },
];

export default function Dashboard() {
  const { user, logout, updateAvatar } = useAuth();
  const { count: cartCount } = useCart();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [feedback, setFeedback] = useState("");
  const [loadingImg, setLoadingImg] = useState(false);

  // Convert an SVG or Emoji preset into a persistent Data URL
  function applyEmojiAvatar(emoji, bg, color) {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background circle
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 240, 240);

    // Emoji text
    ctx.font = "120px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, 120, 130);

    const dataUrl = canvas.toDataURL("image/png");
    updateAvatar(dataUrl);
    showFeedback("Profile picture updated!");
  }

  // Handle user uploading their OWN photo from disk
  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose a valid image file (PNG, JPG, WebP, etc.).");
      return;
    }

    setLoadingImg(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize to a maximum of 360x360 for high quality & lightweight storage
        const maxDim = 360;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.9);
        updateAvatar(compressedDataUrl);
        setLoadingImg(false);
        showFeedback("Your custom profile picture has been saved!");
      };

      img.onerror = () => {
        setLoadingImg(false);
        alert("Failed to load image. Please try another file.");
      };

      img.src = event.target.result;
    };

    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected if desired
    e.target.value = "";
  }

  function handleRemoveAvatar() {
    updateAvatar(null);
    showFeedback("Profile picture removed.");
  }

  function showFeedback(msg) {
    setFeedback(msg);
    setTimeout(() => {
      setFeedback("");
    }, 3500);
  }

  const initial = user?.username ? user.username.charAt(0).toUpperCase() : "U";

  return (
    <div className="app-shell">
      <Navbar />

      <main className="content wide account-page">
        {/* Header Breadcrumb / Title */}
        <div className="account-header">
          <div>
            <span className="account-badge">Account Dashboard</span>
            <h1 className="account-title">My Account</h1>
            <p className="hint">Manage your profile picture, orders, and delivery addresses</p>
          </div>

          <button
            type="button"
            className="ghost dark logout-top-btn"
            onClick={() => {
              if (window.confirm("Are you sure you want to log out?")) {
                logout();
                navigate("/");
              }
            }}
          >
            Log out
          </button>
        </div>

        {feedback && (
          <div className="feedback-banner" role="status">
            ✨ {feedback}
          </div>
        )}

        <div className="account-layout">
          {/* Left Column: Profile Card with Avatar Selection */}
          <section className="profile-card">
            <div className="profile-avatar-container">
              <div
                className="profile-avatar-frame"
                onClick={() => fileInputRef.current?.click()}
                title="Click to choose a new profile picture"
                role="button"
                tabIndex={0}
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.username || "Profile"}
                    className="profile-avatar-img"
                  />
                ) : (
                  <div className="profile-avatar-fallback">{initial}</div>
                )}

                <div className="avatar-edit-overlay">
                  <span>📷 Change</span>
                </div>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
            </div>

            <div className="profile-user-info">
              <h2>{user?.username || "Valued Customer"}</h2>
              <p className="profile-email">{user?.email}</p>
              <span className={`profile-role ${user?.role === 1 ? "role-admin" : "role-customer"}`}>
                {user?.role === 1 ? "👑 Administrator" : "Customer Member"}
              </span>
            </div>

            <div className="profile-pic-controls">
              <button
                type="button"
                className="primary small choose-photo-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={loadingImg}
              >
                {loadingImg ? "Saving..." : "📁 Choose Profile Picture"}
              </button>

              {user?.avatar && (
                <button
                  type="button"
                  className="ghost small remove-photo-btn"
                  onClick={handleRemoveAvatar}
                >
                  Remove Photo
                </button>
              )}
            </div>

            {/* Quick Avatar Presets */}
            <div className="preset-avatars-section">
              <p className="preset-label">Or pick an avatar icon:</p>
              <div className="preset-avatar-grid">
                {PRESET_AVATARS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="preset-avatar-btn"
                    style={{ background: p.bg }}
                    onClick={() => applyEmojiAvatar(p.emoji, p.bg, p.color)}
                    title={p.label}
                  >
                    <span>{p.emoji}</span>
                  </button>
                ))}
              </div>
            </div>

            <hr className="profile-divider" />

            {/* Account meta */}
            <div className="account-meta-list">
              <div className="account-meta-item">
                <span className="meta-label">User ID:</span>
                <span className="meta-value">#{user?.id ?? "—"}</span>
              </div>
              <div className="account-meta-item">
                <span className="meta-label">Role:</span>
                <span className="meta-value">{user?.role === 1 ? "Admin (Role 1)" : "User (Role 0)"}</span>
              </div>
              <div className="account-meta-item">
                <span className="meta-label">Status:</span>
                <span className="meta-value status-active">Active ✅</span>
              </div>
            </div>
          </section>

          {/* Right Column: Prominent Action Buttons (Address, My Orders, Cart, etc.) */}
          <section className="account-actions-section">
            <h2 className="section-title">Quick Actions</h2>

            <div className="actions-grid">
              {/* 1. MY ORDERS BUTTON / CARD */}
              <div
                className="action-card highlight-card"
                onClick={() => navigate("/orders")}
                role="button"
                tabIndex={0}
              >
                <div className="action-card-header">
                  <div className="action-icon-box orders-icon">📦</div>
                  <div className="action-card-text">
                    <h3>My Orders</h3>
                    <p>Track your shipments, view order history, and review previous purchases.</p>
                  </div>
                </div>
                <div className="action-card-footer">
                  <button
                    type="button"
                    className="primary small full-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate("/orders");
                    }}
                  >
                    View My Orders →
                  </button>
                </div>
              </div>

              {/* 2. SAVED ADDRESSES BUTTON / CARD */}
              <div
                className="action-card highlight-card"
                onClick={() => navigate("/address")}
                role="button"
                tabIndex={0}
              >
                <div className="action-card-header">
                  <div className="action-icon-box address-icon">📍</div>
                  <div className="action-card-text">
                    <h3>Saved Addresses</h3>
                    <p>Manage shipping locations, delivery street details, and pin codes.</p>
                  </div>
                </div>
                <div className="action-card-footer">
                  <button
                    type="button"
                    className="ghost small full-btn dark"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate("/address");
                    }}
                  >
                    Manage Addresses →
                  </button>
                </div>
              </div>

              {/* 3. SHOPPING CART BUTTON / CARD */}
              <div
                className="action-card"
                onClick={() => navigate("/cart")}
                role="button"
                tabIndex={0}
              >
                <div className="action-card-header">
                  <div className="action-icon-box cart-icon">🛒</div>
                  <div className="action-card-text">
                    <h3>Shopping Bag</h3>
                    <p>
                      {cartCount > 0
                        ? `You have ${cartCount} item(s) ready for checkout.`
                        : "Your shopping bag is waiting for new items."}
                    </p>
                  </div>
                </div>
                <div className="action-card-footer">
                  <button
                    type="button"
                    className="ghost small full-btn dark"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate("/cart");
                    }}
                  >
                    Open Cart {cartCount > 0 && `(${cartCount})`} →
                  </button>
                </div>
              </div>

              {/* 4. BROWSE STORE / CATALOG */}
              <div
                className="action-card"
                onClick={() => navigate("/")}
                role="button"
                tabIndex={0}
              >
                <div className="action-card-header">
                  <div className="action-icon-box shop-icon">🚗</div>
                  <div className="action-card-text">
                    <h3>Explore Shop</h3>
                    <p>Browse all toy cars, summer & winter sets, and latest arrivals.</p>
                  </div>
                </div>
                <div className="action-card-footer">
                  <button
                    type="button"
                    className="ghost small full-btn dark"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate("/");
                    }}
                  >
                    Browse Catalog →
                  </button>
                </div>
              </div>
            </div>

            {/* Seller/Admin Action: only accessible if user role is 1 */}
            {user?.role === 1 && (
              <div className="admin-banner-card">
                <div className="admin-banner-text">
                  <strong>Admin Portal: Manage Catalog</strong>
                  <p>Add new toy models, pricing, stock levels, and pictures.</p>
                </div>
                <Link to="/admin/add-product" className="primary small link-btn">
                  + Add Product
                </Link>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Footer component */}
      <Footer />
    </div>
  );
}
