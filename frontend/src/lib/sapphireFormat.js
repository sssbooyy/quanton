export function sapphireDisplay(value, formatter) {
  if (value == null || value === "") return "—";
  return formatter ? formatter(value) : String(value);
}

export function sapphireNumber(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString();
}
