const BASE_URL = "http://localhost:8086"; // Spring Boot

export async function apiFetch(path, options = {}) {
  const { headers, ...rest } = options;

  const res = await fetch(BASE_URL + path, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
  });

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