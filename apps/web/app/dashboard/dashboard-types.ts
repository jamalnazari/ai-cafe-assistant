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
  categories?: string[];
  items: MenuItem[];
}
