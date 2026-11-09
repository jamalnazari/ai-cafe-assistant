const persianNumber = new Intl.NumberFormat("fa-IR", {
  maximumFractionDigits: 0,
});

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "۰";
  return persianNumber.format(value);
}

/** قیمت‌ها در دیتابیس به ریال ذخیره می‌شوند و در رابط کاربری به تومان نمایش داده می‌شوند. */
export function formatToman(rialAmount: number | null | undefined): string {
  return formatNumber(Math.round((rialAmount ?? 0) / 10));
}

export function formatItemPrice(
  price: { amount: number } | null | undefined,
): string {
  return formatToman(price?.amount ?? 0);
}

export function restaurantInitial(name: string | null | undefined): string {
  const first = name?.trim().charAt(0);
  return first ? first : "ک";
}
