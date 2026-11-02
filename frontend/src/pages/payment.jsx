import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { formatPrice } from "../services/productService";
import { orderService } from "../services/orderService";
import { paymentService } from "../services/paymentservice";

const METHODS = [
  { id: "cod", title: "Cash on Delivery", text: "Pay when the order arrives." },
  { id: "upi", title: "UPI (demo)", text: "Marked as paid. No real money is charged." },
  { id: "card", title: "Card (demo)", text: "Marked as paid. No card details needed." },
];

export default function Payment() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const orderId = location.state?.orderId; 
  const initialOrder = location.state?.order;

  const [order, setOrder] = useState(initialOrder || null);
  const [method, setMethod] = useState("cod");
  const [loadingOrder, setLoadingOrder] = useState(Boolean(orderId && !initialOrder));
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  // Load the order we are going to pay for (if not passed in state)
  useEffect(() => {
    if (!orderId || initialOrder) return;
    orderService
      .get(orderId)
      .then(setOrder)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingOrder(false));
  }, [orderId, initialOrder]);

  async function handlePay() {
    setPaying(true);
    setError("");
    try {
      // The backend takes the amount from the order, so we send only the order id and the method
      await paymentService.create({ order_id: order.id, method });
      navigate("/orders", { replace: true, state: { paidOrder: order.id } });
    } catch (err) {
      setError(err.message);
      setPaying(false);
    }
  }

  // ---- simple messages (no order, loading, wrong user, already paid) ----
  let message = null;
  if (!orderId && !order) {
    message = <>No order to pay for. <Link to="/orders">Go to my orders</Link></>;
  } else if (loadingOrder) {
    message = "Loading your order...";
  } else if (!order) {
    message = <>{error || "Order not found."} <Link to="/orders">Go to my orders</Link></>;
  } else if (user?.id && order.user_id && Number(order.user_id) !== Number(user.id)) {
    message = <>Order not found. <Link to="/orders">Go to my orders</Link></>;
  } else if (order.status !== "pending") {
    message = <>This order is already {order.status}. <Link to="/orders">See my orders</Link></>;
  }

  if (message) {
    return (
      <div className="app-shell">
        <Navbar />
        <main className="content wide">
          <h1>Payment</h1>
          <p className="hint">{message}</p>
        </main>
      </div>
    );
  }

  const address = order.address;

  return (
    <div className="app-shell">
      <Navbar />
      <main className="content wide">
        <h1>Payment</h1>

        <div className="cart-layout">
          <section className="form pay-form">
            {error && <div className="error" role="alert">{error}</div>}

            {address && (
              <div className="address-box">
                <strong>Delivering to</strong>
                <p>
                  {user?.username || address.name || "Customer"}, {address.phone_number || address.phone}<br />
                  {address.street}, {address.city}, {address.state} - {address.pin_code}
                </p>
              </div>
            )}

            <h2>Choose a payment method</h2>
            <div className="method-list">
              {METHODS.map((m) => (
                <label key={m.id} className={`method ${method === m.id ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="method"
                    value={m.id}
                    checked={method === m.id}
                    onChange={() => setMethod(m.id)}
                  />
                  <span>
                    <strong>{m.title}</strong>
                    <small>{m.text}</small>
                  </span>
                </label>
              ))}
            </div>

            <button className="primary" type="button" onClick={handlePay} disabled={paying}>
              {paying
                ? "Processing..."
                : method === "cod"
                ? "Place order"
                : `Pay ${formatPrice(order.total_amount)}`}
            </button>
          </section>

          <aside className="summary">
            <h2>Order #{order.id}</h2>
            <ul className="pay-items">
              {order.items.map((i) => (
                <li key={i.product_id}>
                  <span>{i.product_name} x {i.quantity}</span>
                  <strong>{formatPrice(i.unit_price * i.quantity)}</strong>
                </li>
              ))}
            </ul>
            <p className="summary-row">
              <span>Total</span>
              <strong>{formatPrice(order.total_amount)}</strong>
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}