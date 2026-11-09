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

export interface RestaurantMenu {
  restaurant_slug: string;
  restaurant_name: string;
  /** لوگوی کافه که صاحب کافه از پنل بارگذاری می‌کند. */
  logo_url?: string | null;
  /** تصویر پس‌زمینهٔ صفحهٔ مشتری. */
  background_url?: string | null;
  categories?: string[];
  items: MenuItem[];
}
