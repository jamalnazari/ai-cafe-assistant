export interface MenuItem {
  id: string;
  name: string;
  category: string;
  description: string;
  price?: { amount: number; currency: string } | null;
}

export interface RestaurantMenu {
  restaurant_slug: string;
  restaurant_name: string;
  items: MenuItem[];
}
