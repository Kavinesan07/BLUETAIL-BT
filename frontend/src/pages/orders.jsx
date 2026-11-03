import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { imageUrl } from "../services/api";
import { formatPrice } from "../services/productService";
import { orderService } from "../services/orderService";

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Orders() {
  const { user } = useAuth();
  const { items, total, clear } = useCart(); 
  const location = useLocation();
  const navigate = useNavigate();

  const address = location.state?.address;               
  const isCheckout = location.state?.checkout === true;  
  const paidOrder = location.state?.paidOrder;           

  const [orders, setOrders] = useState([]);
  const [viewAll, setViewAll] = useState(false);
  const [loading, setLoading] = useState(!isCheckout);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [error, setError] = useState("");

  // "My orders" list mode: load the orders of this user or all orders
  useEffect(() => {
    if (isCheckout) return;
    setLoading(true);
    setError("");
    const targetUserId = viewAll ? null : user?.id;
    orderService
      .list(targetUserId)
      .then(setOrders)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isCheckout, user?.id, viewAll]);

  // "Proceed to Payment": save the order, then open the payment page
  async function handleProceedToPayment() {
    if (!user?.id) {
      setError("Please log in before placing your order.");
      return;
    }
    if (!address?.id) {
      setError("Please add a delivery address first.");
      return;
    }
    if (items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    setCreatingOrder(true);
    setError("");

    try {
      const order = await orderService.create({
        user_id: Number(user.id),
        address_id: Number(address.id),
        items: items.map((i) => ({
          product_id: Number(i.id || i.product_id),
          quantity: Number(i.qty || i.quantity || 1),
        })),
      });

      const orderId = order?.id ?? order?.order?.id;
      if (!orderId) {
        throw new Error("Order was created but no order ID was returned.");
      }

      clear(); 
      navigate("/payment", { state: { orderId, order } });
    } catch (err) {
      setError(err.message || "Failed to proceed to payment.");
      setCreatingOrder(false);
    }
  }

  // ================= Review your order =================
  if (isCheckout) {
    return (
      <div className="app-shell">
        <Navbar />
        <main className="content wide">
          <h1>Review your order</h1>

          {error && <div className="error" role="alert">{error}</div>}

          <section className="order-card">
            <h2>Delivery address</h2>
            {address ? (
              <>
                <p><strong>{address.name}</strong></p>
                <p>{address.phone_number}</p>
                <p>{address.street}</p>
                <p>{address.city}, {address.state} - {address.pin_code}</p>
              </>
            ) : (
              <p>No delivery address was provided.</p>
            )}
            <Link to="/address">Change address</Link>
          </section>

          <section className="order-card review-gap">
            <h2>Order items</h2>

            {items.length === 0 ? (
              <p>Your cart is empty. <Link to="/">Go to the shop</Link></p>
            ) : (
              <ul className="review-list">
                {items.map((i) => (
                  <li key={i.id} className="review-item">
                    {i.image_url ? (
                      <img className="review-thumb" src={imageUrl(i.image_url)} alt={i.name} />
                    ) : (
                      <span className="review-thumb" aria-hidden="true">🚗</span>
                    )}
                    <span className="info">
                      <strong>{i.name}</strong>
                      <small>{formatPrice(i.price)} x {i.qty}</small>
                    </span>
                    <strong>{formatPrice(i.price * i.qty)}</strong>
                  </li>
                ))}
              </ul>
            )}

            <p className="summary-row">
              <span>Total</span>
              <strong>{formatPrice(total)}</strong>
            </p>
          </section>

          <button
            className="primary review-btn"
            type="button"
            onClick={handleProceedToPayment}
            disabled={creatingOrder || !address?.id || items.length === 0}
          >
            {creatingOrder ? "Creating order..." : "Proceed to Payment"}
          </button>
        </main>
      </div>
    );
  }
  return (
    <div className="app-shell">
      <Navbar />
      <main className="content wide">
        <div className="orders-header-row">
          <h1>{viewAll ? "All orders" : "My orders"}</h1>
          <div className="filter-tabs">
            <button
              type="button"
              className={`tab-btn ${!viewAll ? "active" : ""}`}
              onClick={() => setViewAll(false)}
            >
              My orders
            </button>
            <button
              type="button"
              className={`tab-btn ${viewAll ? "active" : ""}`}
              onClick={() => setViewAll(true)}
            >
              All orders
            </button>
          </div>
        </div>

        {paidOrder && (
          <div className="notice-ok" role="status">Order #{paidOrder} placed successfully.</div>
        )}
        {loading && <p className="hint">Loading orders...</p>}
        {error && <div className="error" role="alert">{error}</div>}

        {!loading && !error && orders.length === 0 && (
          <div className="empty">
            <h2>No orders found</h2>
            <p><Link to="/">Start shopping</Link></p>
          </div>
        )}

        <div className="order-list">
          {orders.map((o) => (
            <article key={o.id} className="order-card">
              <header className="order-head">
                <div>
                  <strong>Order #{o.id}</strong>
                  <span className="order-date">{formatDate(o.created_at)}</span>
                </div>
                <span className={`status-badge status-${o.status}`}>{o.status}</span>
              </header>

              {/* Customer & Delivery details ("whose details") */}
              <div className="order-details-box">
                <div className="customer-info">
                  <span className="details-label">👤 Customer:</span>
                  <strong>{o.user?.username || (o.user_id === user?.id ? user?.username : `User #${o.user_id}`)}</strong>
                  {(o.user?.email || (o.user_id === user?.id && user?.email)) && (
                    <span className="details-email">({o.user?.email || user?.email})</span>
                  )}
                </div>

                {o.address ? (
                  <div className="delivery-info">
                    <span className="details-label">📍 Delivery Address:</span>
                    <span className="details-text">
                      {o.address.phone_number && <span>Phone: {o.address.phone_number} • </span>}
                      {o.address.street}, {o.address.city}, {o.address.state} - {o.address.pin_code}
                    </span>
                  </div>
                ) : (
                  <div className="delivery-info">
                    <span className="details-muted">No address details available</span>
                  </div>
                )}
              </div>

              <ul className="order-items">
                {o.items.map((i) => (
                  <li key={i.product_id}>
                    <span>{i.product_name} x {i.quantity}</span>
                    <strong>{formatPrice(i.unit_price * i.quantity)}</strong>
                  </li>
                ))}
              </ul>

              <p className="summary-row">
                <span>Total</span>
                <strong>{formatPrice(o.total_amount)}</strong>
              </p>

              {o.status === "pending" && (
                <div className="order-actions">
                  <span className="hint">Waiting for payment</span>
                  <Link to="/payment" state={{ orderId: o.id, order: o }} className="primary link-btn-block">
                    Pay now
                  </Link>
                </div>
              )}
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
