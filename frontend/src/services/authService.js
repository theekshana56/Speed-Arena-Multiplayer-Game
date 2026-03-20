// src/services/authService.js

import { apiFetch } from "./apiClient";
import { tokenService } from "./tokenService";

export async function registerUser(username, email, password) {
  const data = await apiFetch("/api/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });

  if (data?.token) {
    tokenService.set(data.token); // ✅ save token
  }

  return data;
}

export async function loginUser(username, password) {
  const data = await apiFetch("/api/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  if (data?.token) {
    tokenService.set(data.token); // ✅ save token
  }

  return data;
}