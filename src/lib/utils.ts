export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function toNumber(value: string | number) {
  const number = typeof value === "number" ? value : Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}
