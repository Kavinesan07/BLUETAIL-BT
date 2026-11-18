import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authService } from "../services/authService";
import AuthLayout from "../components/AuthLayout";
import FormField from "../components/FormField";

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();

  // Step 1: Request OTP | Step 2: Enter OTP & New Password | Step 3: Success
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  // If query params are provided (e.g. from an email link: ?email=...&otp=...)
  useEffect(() => {
    const paramEmail = searchParams.get("email");
    const paramOtp = searchParams.get("otp");
    if (paramEmail) setEmail(paramEmail);
    if (paramOtp) setOtp(paramOtp);
    if (paramEmail && paramOtp) {
      setStep(2);
    }
  }, [searchParams]);

  function validateStep1() {
    const next = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      next.email = "Enter a valid email address.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateStep2() {
    const next = {};
    if (!otp.trim()) {
      next.otp = "Enter the 6-digit OTP code.";
    } else if (otp.trim().length < 4) {
      next.otp = "OTP must be at least 4 digits.";
    }

    if (!newPassword) {
      next.newPassword = "Enter your new password.";
    } else if (newPassword.length < 6) {
      next.newPassword = "Password must be at least 6 characters.";
    }

    if (newPassword !== confirmPassword) {
      next.confirmPassword = "Passwords do not match.";
    }

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
      const res = await authService.forgotPassword(email.trim());
      setNotice(res.message || "Password reset OTP sent to your email!");
      if (res.dev_otp) {
        setNotice(`OTP code sent! (Dev code: ${res.dev_otp})`);
        setOtp(res.dev_otp);
      }
      setStep(2);
    } catch (err) {
      setServerError(err.message || "Failed to send reset code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setServerError("");
    setNotice("");
    if (!validateStep2()) return;

    setLoading(true);
    try {
      const res = await authService.resetPassword(
        email.trim(),
        otp.trim(),
        newPassword
      );
      setNotice(res.message || "Password reset successfully!");
      setStep(3);
    } catch (err) {
      setServerError(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      {step === 1 && (
        <form className="form" onSubmit={handleSendOtp} noValidate>
          <h2>Reset password</h2>
          <p className="hint">
            Enter your registered email and we will send a 6-digit OTP to reset your password.
          </p>

          {notice && <div className="success" role="status">{notice}</div>}
          {serverError && <div className="error" role="alert">{serverError}</div>}

          <FormField
            id="email"
            name="email"
            type="email"
            label="Email address"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />

          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Sending code..." : "Send Reset Code"}
          </button>

          <p className="switch">
            Remember your password? <Link to="/login">Back to log in</Link>
          </p>
        </form>
      )}

      {step === 2 && (
        <form className="form" onSubmit={handleResetPassword} noValidate>
          <h2>Create new password</h2>
          <p className="hint">
            Enter the 6-digit code sent to <strong>{email}</strong> and choose your new password.
          </p>

          {notice && <div className="success" role="status">{notice}</div>}
          {serverError && <div className="error" role="alert">{serverError}</div>}

          <FormField
            id="otp"
            name="otp"
            type="text"
            label="6-Digit OTP Code"
            placeholder="e.g. 123456"
            autoComplete="one-time-code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            error={errors.otp}
          />

          <FormField
            id="newPassword"
            name="newPassword"
            type="password"
            label="New password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={errors.newPassword}
          />

          <FormField
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            label="Confirm new password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirmPassword}
          />

          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Updating password..." : "Reset Password"}
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

      {step === 3 && (
        <div className="form">
          <h2>Password updated!</h2>
          <p className="hint" style={{ color: "#16a34a" }}>
            Your password has been changed successfully. You can now sign in with your new password.
          </p>

          <Link
            to="/login"
            className="primary"
            style={{
              display: "block",
              textAlign: "center",
              textDecoration: "none",
              marginTop: "1.5rem",
            }}
          >
            Go to Log in
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
