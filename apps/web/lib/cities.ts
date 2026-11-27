/** شهرهایی که صفحهٔ هاب دارند؛ برای افزودن شهر جدید فقط یک مورد اضافه کنید. */
export const CITIES = [
  {
    slug: "gorgan",
    name: "گرگان",
    region: "گلستان",
    intro:
      "گرگان از قدیم خانهٔ غذاهای اصیل شمالی بوده است؛ از چکدرمه و ترکمنی گرفته تا کباب‌های سنتی و آش‌های محلی. در این صفحه کافه‌ها و رستوران‌هایی را معرفی می‌کنیم که منوی دیجیتال کامل، آدرس، ساعت کاری و قیمت‌های به‌روز دارند.",
  },
] as const;

export type CityEntry = (typeof CITIES)[number];

export function findCity(slug: string): CityEntry | undefined {
  return CITIES.find((city) => city.slug === slug);
}
