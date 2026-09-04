export function normalizePakistaniMobile(phone: string): string | null {
  const compact = phone.trim().replace(/[\s().-]/g, "");
  const digits = compact.startsWith("+") ? compact.slice(1) : compact;
  if (/^03\d{9}$/.test(digits)) return `+92${digits.slice(1)}`;
  if (/^923\d{9}$/.test(digits)) return `+${digits}`;
  if (/^00923\d{9}$/.test(digits)) return `+${digits.slice(2)}`;
  return null;
}
