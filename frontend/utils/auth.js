/**
 * Shared utility to retrieve and refresh JWT tokens.
 * Centralizing this prevents logic drift between components and hooks.
 */
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const LOGIN_PATH = "/login";

const clearStoredTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

const getTokenPayload = (token) => {
  const payload = token.split(".")[1];
  return JSON.parse(atob(payload));
};

const isTokenExpired = (token) => {
  try {
    const payload = getTokenPayload(token);
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

export const getAuthToken = async () => {
  if (typeof globalThis.window === "undefined") {
    return null;
  }

  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

  if (!accessToken || !refreshToken) {
    return null;
  }

  if (!isTokenExpired(accessToken)) {
    return accessToken;
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      clearStoredTokens();
      globalThis.location.href = LOGIN_PATH;
      return null;
    }

    const data = await response.json();
    localStorage.setItem(ACCESS_TOKEN_KEY, data.access);
    return data.access;
  } catch {
    clearStoredTokens();
    globalThis.location.href = LOGIN_PATH;
    return null;
  }
};
