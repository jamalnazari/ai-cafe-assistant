/** خواندن پیام خطای API و تبدیل آن به پیام فارسیِ قابل فهم برای کاربر.
 *
 * بک‌اند برای خطاهای اعتبارسنجی (422) آرایه‌ای از آیتم‌های pydantic می‌فرستد
 * که پیام بعضی‌شان انگلیسی خام است (مثل «String should have at least 8
 * characters») و پیام فارسی اعتبارسنج‌ها هم با پیشوند فنی «Value error, »
 * می‌آید. این ماژول هر دو حالت را به پیام فارسی تمیز تبدیل می‌کند.
 */

type ValidationErrorItem = {
  type?: string;
  msg?: string;
  loc?: unknown[];
  ctx?: Record<string, unknown> | null;
};

const FIELD_LABELS: Record<string, string> = {
  name: "نام کافه",
  label_word: "واژهٔ نمایشی",
  slug: "نشانی منو",
  owner_username: "نام کاربری صاحب کافه",
  owner_password: "رمز عبور",
  about: "دربارهٔ مجموعه",
  item_key: "شناسهٔ آیتم",
  category: "دسته‌بندی",
  description: "توضیحات",
  price_amount: "قیمت",
  sort_order: "ترتیب نمایش",
  question: "پرسش",
};

function faNumber(value: number): string {
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(value);
}

function fieldLabel(item: ValidationErrorItem): string {
  const loc = Array.isArray(item.loc) ? item.loc : [];
  const last = loc[loc.length - 1];
  return typeof last === "string" ? (FIELD_LABELS[last] ?? "") : "";
}

function translateValidationItem(item: ValidationErrorItem): string | null {
  const field = fieldLabel(item);
  const subject = field ? `«${field}»` : "مقدار وارد‌شده";

  switch (item.type) {
    case "string_too_short": {
      const min = item.ctx?.min_length;
      return typeof min === "number"
        ? `${subject} باید حداقل ${faNumber(min)} نویسه باشد.`
        : `${subject} بیش از حد کوتاه است.`;
    }
    case "string_too_long": {
      const max = item.ctx?.max_length;
      return typeof max === "number"
        ? `${subject} نباید بیشتر از ${faNumber(max)} نویسه باشد.`
        : `${subject} بیش از حد طولانی است.`;
    }
    case "string_pattern_mismatch":
      return `${subject} در قالب مجاز نیست؛ راهنمای کنار فیلد را ببینید.`;
    case "missing":
      return `${subject} الزامی است؛ آن را وارد کنید.`;
    case "greater_than_equal": {
      const min = item.ctx?.ge;
      return typeof min === "number"
        ? `${subject} نمی‌تواند منفی باشد یا کمتر از ${faNumber(min)}.`
        : `${subject} باید عددی نامنفی باشد.`;
    }
    case "value_error":
      // پیام فارسی خودِ اعتبارسنج بک‌اند؛ فقط پیشوند فنی حذف می‌شود.
      if (typeof item.msg === "string" && item.msg.startsWith("Value error, ")) {
        return item.msg.slice("Value error, ".length);
      }
      return item.msg ?? null;
    default:
      // پیام‌های فارسیِ ناشناخته همان‌طور نمایش داده می‌شوند؛ انگلیسی‌ها نه.
      if (
        typeof item.msg === "string" &&
        item.msg.trim() &&
        !/^[A-Za-z]/.test(item.msg.trim())
      ) {
        return item.msg.trim();
      }
      return null;
  }
}

export async function readApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  const data = (await response.json().catch(() => null)) as
    | { detail?: string | ValidationErrorItem[] }
    | null;

  if (typeof data?.detail === "string" && data.detail.trim()) {
    return data.detail.trim();
  }

  if (Array.isArray(data?.detail)) {
    for (const item of data.detail) {
      const message = translateValidationItem(item);
      if (message) return message;
    }
  }

  return fallback;
}
