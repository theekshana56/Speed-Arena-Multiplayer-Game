const BASE_URL = "http://localhost:8080"; // Spring Boot

export async function apiFetch(path, options = {}) {

  const finalOptions = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  };

  const res = await fetch(BASE_URL + path, finalOptions);

  const text = await res.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}