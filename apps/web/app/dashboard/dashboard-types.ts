export interface MenuItem {
  id: string;
  name: string;
  category: string;
  description: string;
  image_url?: string | null;
  is_spicy?: boolean | null;
  price?: { amount: number; currency: string } | null;
}

export interface RestaurantMenu {
  restaurant_slug: string;
  restaurant_name: string;
  restaurant_label?: string;
  logo_url?: string | null;
  background_url?: string | null;
  restaurant_about?: string | null;
  categories?: string[];
  items: MenuItem[];
}

export type BrandingKind = "logo" | "background";
