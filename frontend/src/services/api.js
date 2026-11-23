import { clearSession, readToken } from "./session.js";

const API = "/api";

async function requestApi(path, options = {}, formData = false) {
  const headers = formData ? {} : { "Content-Type": "application/json" };
  if (options.auth && readToken()) headers.Authorization = "Bearer " + readToken();

  const response = await fetch(API + path, {
    method: options.method || "POST",
    headers,
    body: options.body ? formData ? options.body : JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = Error(data.message || "Request failed (" + response.status + ").");
    error.status = response.status;
    error.retryAfterSeconds = Number(data.retryAfterSeconds) || 0;
    const blocked = response.status === 403 && /blocked/i.test(data.message || "");
    if (options.auth && (response.status === 401 || blocked)) {
      clearSession();
      window.dispatchEvent(new CustomEvent("skillbridge:session-expired", {
        detail: { message: data.message || "Your session expired. Please sign in again." },
      }));
    }
    throw error;
  }
  return data;
}

export function api(path, options = {}) {
  return requestApi(path, options);
}

export function apiForm(path, options = {}) {
  return requestApi(path, options, true);
}

