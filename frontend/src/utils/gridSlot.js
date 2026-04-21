/** Lobby / race start grid index 0–3 (matches server slot order). */
export function clampGridSlot(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.min(3, Math.max(0, Math.floor(v)));
}
