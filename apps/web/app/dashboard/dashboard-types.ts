export interface MenuItem {
  id: string;
  name: string;
  category: string;
  description: string;
  image_url?: string | null;
  is_spicy?: boolean | null;
  price?: { amount: number; currency: string } | null;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface RestaurantMenu {
  restaurant_slug: string;
  restaurant_name: string;
  restaurant_label?: string;
  logo_url?: string | null;
  background_url?: string | null;
  restaurant_about?: string | null;
  // اطلاعات تماس و سئوی محلی
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

export type BrandingKind = "logo" | "background";
