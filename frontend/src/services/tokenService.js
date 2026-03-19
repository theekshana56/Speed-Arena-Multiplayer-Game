export const tokenService = {
  get() {
    return localStorage.getItem("token");
  },
  set(token) {
    localStorage.setItem("token", token);
  },
  clear() {
    localStorage.removeItem("token");
  },
};