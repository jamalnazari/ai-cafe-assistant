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
  // اطلاعات تماس و سئوی محلی
  address: string | null;
  phone: string | null;
  opening_hours: string | null;
  price_range: string | null;
  city: string | null;
  cuisine_tags: string[] | null;
  faq: CafeFaq[];
  faq_question_count: number;
};

export type CafeFaq = { question: string; answer: string };

/** یک اتصال سرویس هوش مصنوعی؛ کلید فقط به شکل ماسک‌شده نمایش داده می‌شود. */
export type LlmApiKey = {
  id: number;
  label: string | null;
  base_url: string;
  model: string | null;
  api_key_masked: string;
  is_active: boolean;
};

export type LlmKeysList = {
  keys: LlmApiKey[];
  racing_enabled: boolean;
};

export const LABEL_SUGGESTIONS = [
  "کافه",
  "رستوران",
  "کافه رستوران",
  "کافه‌رستوران",
  "قهوه‌خانه",
  "فست‌فود",
];
