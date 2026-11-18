import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import AuthLayout from "../components/AuthLayout";
import FormField from "../components/FormField";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  // Step 1: Enter account details & send OTP, Step 2: Verify OTP & create account
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [otp, setOtp] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  function validateStep1() {
    const next = {};
    if (!form.username.trim()) next.username = "Enter a username.";
    if (form.username.trim().length < 2) next.username = "Username must be at least 2 characters.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email address.";
    if (form.password.length < 6) next.password = "Password must be at least 6 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateStep2() {
    const next = {};
    if (!otp.trim()) next.otp = "Enter the 6-digit verification code.";
    else if (otp.trim().length < 4) next.otp = "Code must be at least 4 digits.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSendOtp(e) {
    e.preventDefault();
    setServerError("");
    setNotice("");
    if (!validateStep1()) return;

    setLoading(true);
    try {
      const res = await authService.sendRegistrationOtp(
        form.username.trim(),
        form.email.trim()
      );
      setNotice(res.message || "Verification code sent to your email!");
      if (res.dev_otp) {
        setNotice(`Verification code sent! (Dev code: ${res.dev_otp})`);
        setOtp(res.dev_otp);
      }
      setStep(2);
    } catch (err) {
      setServerError(err.message || "Could not send verification code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyAndRegister(e) {
    e.preventDefault();
    setServerError("");
    setNotice("");
    if (!validateStep2()) return;

    setLoading(true);
    try {
      await register(
        form.username.trim(),
        form.email.trim(),
        form.password,
        otp.trim()
      );
      // Redirect to login page so user logs in for the first time
      navigate("/login", {
        replace: true,
        state: { notice: "Account created successfully! Please log in with your email and password." },
      });
    } catch (err) {
      setServerError(err.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      {step === 1 ? (
        <form className="form" onSubmit={handleSendOtp} noValidate>
          <h2>Create your account</h2>
          <p className="hint">Enter your details to receive an email verification code.</p>

          {notice && <div className="success" role="status">{notice}</div>}
          {serverError && <div className="error" role="alert">{serverError}</div>}

          <FormField
            id="username"
            name="username"
            label="Username"
            autoComplete="username"
            value={form.username}
            onChange={handleChange}
            error={errors.username}
          />
          <FormField
            id="email"
            name="email"
            type="email"
            label="Email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            error={errors.email}
          />
          <FormField
            id="password"
            name="password"
            type="password"
            label="Password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
          />

          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Sending code..." : "Send Verification Code"}
          </button>

          <p className="switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </form>
      ) : (
        <form className="form" onSubmit={handleVerifyAndRegister} noValidate>
          <h2>Verify your email</h2>
          <p className="hint">
            We sent a 6-digit code to <strong>{form.email}</strong>. Enter it below to activate your account.
          </p>

          {notice && <div className="success" role="status">{notice}</div>}
          {serverError && <div className="error" role="alert">{serverError}</div>}

          <FormField
            id="otp"
            name="otp"
            type="text"
            label="6-Digit Verification Code"
            placeholder="e.g. 123456"
            autoComplete="one-time-code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            error={errors.otp}
          />

          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Verify & Create Account"}
          </button>

          <p className="switch">
            <button
              type="button"
              className="link-btn"
              style={{
                background: "none",
                border: "none",
                color: "var(--tail, #0284c7)",
                cursor: "pointer",
                padding: 0,
                fontSize: "0.95rem",
              }}
              onClick={() => setStep(1)}
            >
              ← Edit email or resend code
            </button>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
