export type AdminRestaurant = {
  id: number;
  slug: string;
  name: string;
  label_word: string;
  about: string | null;
  is_active: boolean;
  owner_username: string | null;
  owner_is_active: boolean;
  item_count: number;
  category_count: number;
  logo_url: string | null;
  background_url: string | null;
  menu_path: string;
};

export const LABEL_SUGGESTIONS = [
  "کافه",
  "رستوران",
  "کافه رستوران",
  "کافه‌رستوران",
  "قهوه‌خانه",
  "فست‌فود",
];
