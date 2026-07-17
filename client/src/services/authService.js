import { request } from "./api.js";

export const authService = {
  login(credentials) {
    return request("/auth/login", {
      method: "POST",
      body: credentials,
    });
  },
  register(credentials) {
    return request("/auth/register", {
      method: "POST",
      body: credentials,
    });
  },
  getCurrentUser(token) {
    return request("/auth/me", {
      method: "GET",
      token,
    }).then((payload) => payload.data);
  },
  logout(token) {
    return request("/auth/logout", {
      method: "GET",
      token,
    });
  },
};
