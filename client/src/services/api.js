// Same-origin "/api" works for local dev (via the Vite proxy) and for a
// combined single-process deploy. When the frontend and API are hosted
// separately (e.g. client on Vercel, API on Render), set VITE_API_BASE_URL
// to the API's absolute origin + "/api".
const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export async function request(path, options = {}) {
  const { token, body, headers = {}, ...rest } = options;

  const response = await fetch(`${DEFAULT_API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    let errorMessage;

    if (typeof payload === "string") {
      errorMessage = payload;
    } else if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
      // express-validator sends field errors as { errors: [{ msg, path, ... }] }
      // instead of a top-level message.
      errorMessage = payload.errors
        .map((fieldError) => fieldError.msg)
        .filter(Boolean)
        .join(" ");
    } else {
      errorMessage =
        payload?.message || `Request failed with status ${response.status}`;
    }

    throw new Error(errorMessage || `Request failed with status ${response.status}`);
  }

  return payload;
}
