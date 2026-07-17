import { request } from "./api.js";

export const userService = {
  getProfile(token) {
    return request("/users/profile", {
      method: "GET",
      token,
    }).then((payload) => payload.data);
  },
  updateProfile(token, profileUpdates) {
    return request("/users/profile", {
      method: "PUT",
      token,
      body: profileUpdates,
    });
  },
  deleteProfile(token) {
    return request("/users/profile", {
      method: "DELETE",
      token,
    });
  },
};
