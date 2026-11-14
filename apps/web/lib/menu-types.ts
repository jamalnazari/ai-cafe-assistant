export interface MenuItem {
  id: string;
  name: string;
  category: string;
  description: string;
  image_url?: string | null;
  ingredients?: string[] | null;
  allergens?: string[] | null;
  is_spicy?: boolean | null;
  serving_temperature?: "hot" | "cold" | "room_temperature" | null;
  price?: {
    amount: number;
    currency: string;
  } | null;
  is_available: boolean;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface RestaurantMenu {
  restaurant_slug: string;
  restaurant_name: string;
  /** واژهٔ نمایشی قبل از نام: کافه، رستوران، کافه‌رستوران … */
  restaurant_label?: string;
  /** لوگوی کافه که صاحب کافه از پنل بارگذاری می‌کند. */
  logo_url?: string | null;
  /** تصویر پس‌زمینهٔ صفحهٔ مشتری. */
  background_url?: string | null;
  /** توضیحات کلی مجموعه که دستیار هوشمند در پاسخ‌ها در نظر می‌گیرد. */
  restaurant_about?: string | null;
  /** اطلاعات تماس و سئوی محلی (آدرس، تلفن، ساعت کاری، محدودهٔ قیمت). */
  restaurant_address?: string | null;
  restaurant_phone?: string | null;
  opening_hours?: string | null;
  price_range?: string | null;
  city?: string | null;
  cuisine_tags?: string[];
  faq?: FaqItem[];
  categories?: string[];
  items: MenuItem[];
}

/** خلاصهٔ عمومی کافه برای صفحهٔ هاب شهر و نقشهٔ سایت. */
export interface PublicRestaurant {
  slug: string;
  name: string;
  label_word: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  opening_hours?: string | null;
  price_range?: string | null;
  about?: string | null;
  cuisine_tags?: string[];
  logo_url?: string | null;
  background_url?: string | null;
  menu_path: string;
  item_count: number;
}
