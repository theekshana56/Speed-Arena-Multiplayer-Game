/**
 * Multiplayer identity: one stable network id per browser tab (sessionStorage).
 * playerName alone is not unique — duplicate logins across tabs would share the same
 * id and Unity would treat remote updates as the local player.
 */

const STORAGE_KEY = "speedArenaNetworkPlayerId";

function slugBaseName(raw) {
  const s = (raw || "player").toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return (s || "player").slice(0, 24);
}

function randomSuffix() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getOrCreateNetworkPlayerId() {
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing && existing.trim()) {
      return existing;
    }

    const display = sessionStorage.getItem("playerName") || sessionStorage.getItem("username") || "player";
    // React StrictMode (dev) may remount components and rerun this function.
    // If we generate a new suffix each time, the backend thinks it's a new player
    // and start slots can end up wrong (e.g. both cars on the same slot).
    //
    // Use a tab-scoped value stored on `window`, stable for the life of the browser tab.
    if (typeof window !== "undefined") {
      if (!window.__speedArenaTabScopedId) {
        window.__speedArenaTabScopedId = randomSuffix();
      }
      const id = `${slugBaseName(display)}_${window.__speedArenaTabScopedId}`;
      sessionStorage.setItem(STORAGE_KEY, id);
      return id;
    }

    const id = `${slugBaseName(display)}_${randomSuffix()}`;
    sessionStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return `player_${randomSuffix()}`;
  }
}

export function clearNetworkPlayerId() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
