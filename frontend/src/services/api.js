export const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// JWT token helper: parses base64url payload safely
export function parseJwt(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// Check whether a JWT token is structurally valid and not expired
export function isTokenValid(token) {
  if (!token) return false;
  const decoded = parseJwt(token);
  if (!decoded) return false;
  if (!decoded.exp) return false;
  // exp is in seconds (unix epoch)
  const now = Math.floor(Date.now() / 1000);
  return decoded.exp > now;
}

// JWT token & session management - strictly using sessionStorage for browser-session isolation
export const auth = {
  getToken: () => {
    // Purge any legacy localStorage tokens to ensure session isolation
    if (typeof localStorage !== "undefined" && localStorage.getItem("bluetail_token")) {
      localStorage.removeItem("bluetail_token");
      localStorage.removeItem("bluetail_user");
    }

    const token = sessionStorage.getItem("access_token");
    if (!token) return null;
    if (!isTokenValid(token)) {
      auth.removeToken();
      return null;
    }
    return token;
  },

  setToken: (token) => {
    if (token) {
      sessionStorage.setItem("access_token", token);
    }
    // Never store auth token in localStorage
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("bluetail_token");authcontext
    }
  },

  removeToken: () => {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("user");
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("bluetail_token");
      localStorage.removeItem("bluetail_user");
    }
  },

  getUser: () => {
    // Only return user if a valid unexpired token exists in sessionStorage
    const token = auth.getToken();
    if (!token) {
      sessionStorage.removeItem("user");
      return null;
    }
    try {
      const user = sessionStorage.getItem("user");
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  setUser: (user) => {
    if (user) {
      sessionStorage.setItem("user", JSON.stringify(user));
    }
  },

  isAuthenticated: () => {
    return !!auth.getToken();
  },
};

// Image URL helper
export function imageUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}

// Main API request function
async function request(path, { method = "GET", body } = {}) {
  const isForm = body instanceof FormData;

  // Get JWT token
  const token = auth.getToken();

  const headers = {};

  if (!isForm) {
    headers["Content-Type"] = "application/json";
  }

  // Automatically attach JWT Bearer token
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res;

  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body
        ? isForm
          ? body
          : JSON.stringify(body)
        : undefined,
    });
  } catch {
    throw new ApiError(
      "Cannot reach the server. Check that the API is running.",
      0
    );
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = Array.isArray(data.detail)
      ? "Please check the fields and try again."
      : data.detail || "Something went wrong. Try again.";

    // If unauthorized or token expired, clean up token
    if (res.status === 401 && token) {
      auth.removeToken();
    }

    throw new ApiError(message, res.status);
  }

  // Automatically save JWT when login or register returns an access token
  if (data.access_token) {
    auth.setToken(data.access_token);
  }

  return data;
}

// API methods
export const api = {
  get: (path) => request(path),

  post: (path, body) => request(path, { method: "POST", body }),

  delete: (path) => request(path, { method: "DELETE" }),

  // Logout
  logout: () => {
    auth.removeToken();
  },
};
