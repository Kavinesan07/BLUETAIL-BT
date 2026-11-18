import { api } from "./api";

export const authService = {
  login: (email, password) => api.post("/users/login", { email, password }),
  sendRegistrationOtp: (username, email) =>
    api.post("/users/send-registration-otp", { username, email }),
  register: (username, email, password, otp) =>
    api.post("/users/create", { username, email, password, otp }),
  getUser: (userId) => api.get(`/users/${userId}`),
  getMe: () => api.get("/users/me"),
  forgotPassword: (email) => api.post("/users/forgot-password", { email }),
  verifyOtp: (email, otp) => api.post("/users/verify-otp", { email, otp }),
  resetPassword: (email, otp, new_password) =>
    api.post("/users/reset-password", { email, otp, new_password }),
};
