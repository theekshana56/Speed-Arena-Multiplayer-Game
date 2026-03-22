const BASE_URL = "http://127.0.0.1:8080"; // Using explicit IP for local stability

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
    const errorMsg = data.message || data.error || text || "Request failed";
    console.error(`[API ERROR] ${path}:`, errorMsg);
    throw new Error(errorMsg);
  }

  return data;
}