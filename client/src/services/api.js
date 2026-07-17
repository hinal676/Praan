const DEFAULT_API_BASE_URL = "/api";

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
    const errorMessage =
      typeof payload === "string"
        ? payload
        : payload?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload;
}
