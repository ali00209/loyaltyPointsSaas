export function formatPKR(
  value: number | string | null | undefined,
): string {
  const amount = typeof value === "string" ? Number(value) : value;
  if (amount == null || !Number.isFinite(amount)) return "PKR 0.00";
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
