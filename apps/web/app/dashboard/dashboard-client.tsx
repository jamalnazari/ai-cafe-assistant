"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NextImage from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  Check,
  CircleAlert,
  Coffee,
  Copy,
  ExternalLink,
  Flame,
  Image as ImageIcon,
  ImagePlus,
  Info,
  LoaderCircle,
  LogOut,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Store,
  Tags,
  Trash2,
  TriangleAlert,
  UtensilsCrossed,
} from "lucide-react";

import MenuCategoryNav from "@/components/menu-category-nav";
import ThemeSwitcher from "@/components/theme-switcher";
import Modal from "@/components/ui/modal";
import { ToastViewport, useToasts } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import {
  formatItemPrice,
  formatNumber,
  restaurantInitial,
} from "@/lib/format";
import { useCategoryScrollSpy } from "@/lib/use-category-scroll-spy";
import type { BrandingKind, MenuItem, RestaurantMenu } from "./dashboard-types";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type DashboardClientProps = {
  ownerEmail: string;
  qrUrl: string;
  initialMenu: RestaurantMenu | null;
};

type CategoryDeleteMode = "move" | "delete_items";

async function getResponseError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as {
    detail?: string;
  } | null;
  return data?.detail ?? fallback;
}

function validateImageFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "فرمت تصویر باید JPG، PNG یا WebP باشد.";
  }
  if (file.size === 0) return "فایل تصویر خالی است.";
  if (file.size > MAX_IMAGE_BYTES) {
    return "حجم تصویر نباید بیشتر از ۵ مگابایت باشد.";
  }
  return null;
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3 shadow-card sm:p-3.5">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-2.5 text-lg font-black tabular-nums">{formatNumber(value)}</p>
      <p className="text-[10px] font-bold text-ink-faint">{label}</p>
    </div>
  );
}

export default function DashboardClient({
  ownerEmail,
  qrUrl,
  initialMenu,
}: DashboardClientProps) {
  const router = useRouter();
  const { toasts, push, dismiss } = useToasts();

  const [menu, setMenu] = useState<RestaurantMenu | null>(initialMenu);
  const [actionError, setActionError] = useState<string | null>(
    initialMenu ? null : "دریافت منو ناموفق بود؛ لطفاً دوباره تلاش کنید.",
  );
  const [loggingOut, setLoggingOut] = useState(false);

  // --- فرم آیتم ---
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [priceToman, setPriceToman] = useState("");
  const [isSpicy, setIsSpicy] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingItemKey, setUploadingItemKey] = useState<string | null>(null);

  // --- حذف آیتم ---
  const [itemPendingDelete, setItemPendingDelete] = useState<MenuItem | null>(
    null,
  );
  const [deletingItem, setDeletingItem] = useState(false);

  // --- دسته‌بندی‌ها ---
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryPendingDelete, setCategoryPendingDelete] = useState<
    string | null
  >(null);
  const [categoryDeleteMode, setCategoryDeleteMode] =
    useState<CategoryDeleteMode>("move");
  const [categoryMoveTarget, setCategoryMoveTarget] = useState("");
  const [categoryDeleteError, setCategoryDeleteError] = useState<string | null>(
    null,
  );
  const [deletingCategory, setDeletingCategory] = useState(false);

  // --- هویت کافه (نام، لوگو، پس‌زمینه) ---
  const [brandName, setBrandName] = useState("");
  const [savingBrandName, setSavingBrandName] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [uploadingBranding, setUploadingBranding] = useState<BrandingKind | null>(
    null,
  );
  const lastSyncedBrandName = useRef<string | null>(null);

  // --- دربارهٔ مجموعه (توضیحاتی که دستیار هوشمند هم می‌خواند) ---
  const [aboutText, setAboutText] = useState("");
  const [savingAbout, setSavingAbout] = useState(false);
  const [aboutError, setAboutError] = useState<string | null>(null);
  const lastSyncedAbout = useRef<string | null>(null);

  // در موبایل فقط یکی از دو بخش «منو» یا «مدیریت کافه» نمایش داده می‌شود.
  const [mobilePanel, setMobilePanel] = useState<"menu" | "settings">("menu");

  const items = useMemo(() => menu?.items ?? [], [menu]);
  const restaurantSlug = menu?.restaurant_slug ?? "demo";

  const categoryNames = useMemo(() => {
    if (!menu) return [];
    return Array.from(
      new Set([
        ...(menu.categories ?? []),
        ...menu.items.map((item) => item.category),
      ]),
    );
  }, [menu]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const categoryName of categoryNames) {
      counts.set(
        categoryName,
        items.filter((item) => item.category === categoryName).length,
      );
    }
    return counts;
  }, [categoryNames, items]);

  const categoryList = useMemo(
    () =>
      categoryNames.map((categoryName) => ({
        name: categoryName,
        count: categoryCounts.get(categoryName) ?? 0,
      })),
    [categoryNames, categoryCounts],
  );

  const { activeCategory, navRef, menuRef, scrollToCategory } =
    useCategoryScrollSpy(categoryNames);

  const editingItem =
    editingItemKey !== null
      ? (items.find((item) => item.id === editingItemKey) ?? null)
      : null;

  const fetchMenu = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/restaurants/demo/menu`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "دریافت منو ناموفق بود."),
        );
      }
      setMenu((await response.json()) as RestaurantMenu);
      setActionError(null);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "دریافت منو ناموفق بود.",
      );
    }
  }, []);

  const handleExpiredSession = useCallback(
    (response: Response) => {
      if (response.status !== 401) return false;
      router.replace("/login");
      router.refresh();
      return true;
    },
    [router],
  );

  useEffect(() => {
    const name = menu?.restaurant_name;
    if (!name || name === lastSyncedBrandName.current) return;
    lastSyncedBrandName.current = name;
    setBrandName(name);
  }, [menu?.restaurant_name]);

  useEffect(() => {
    const about = menu?.restaurant_about ?? "";
    if (about === lastSyncedAbout.current) return;
    lastSyncedAbout.current = about;
    setAboutText(about);
  }, [menu?.restaurant_about]);

  const saveBrandName = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = brandName.trim();
    if (!name || savingBrandName) return;

    setSavingBrandName(true);
    setBrandError(null);
    try {
      const response = await fetch(`/api/v1/restaurants/${restaurantSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "same-origin",
      });
      if (handleExpiredSession(response)) return;
      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "ذخیرهٔ نام کافه ناموفق بود."),
        );
      }
      await fetchMenu();
      push("نام کافه به‌روزرسانی شد.");
    } catch (error) {
      setBrandError(
        error instanceof Error ? error.message : "ذخیرهٔ نام کافه ناموفق بود.",
      );
    } finally {
      setSavingBrandName(false);
    }
  };

  const saveAbout = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingAbout) return;

    setSavingAbout(true);
    setAboutError(null);
    try {
      const response = await fetch(`/api/v1/restaurants/${restaurantSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about: aboutText }),
        credentials: "same-origin",
      });
      if (handleExpiredSession(response)) return;
      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "ذخیرهٔ توضیحات مجموعه ناموفق بود."),
        );
      }
      const data = (await response.json()) as { about?: string | null };
      lastSyncedAbout.current = data.about ?? "";
      setAboutText(data.about ?? "");
      await fetchMenu();
      push(
        data.about
          ? "توضیحات مجموعه ذخیره شد و در پاسخ‌های دستیار در نظر گرفته می‌شود."
          : "توضیحات مجموعه پاک شد.",
      );
    } catch (error) {
      setAboutError(
        error instanceof Error
          ? error.message
          : "ذخیرهٔ توضیحات مجموعه ناموفق بود.",
      );
    } finally {
      setSavingAbout(false);
    }
  };

  const uploadBrandingImage = async (kind: BrandingKind, file: File) => {
    const validationError = validateImageFile(file);
    if (validationError) {
      setBrandError(validationError);
      return;
    }

    setUploadingBranding(kind);
    setBrandError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        `/api/v1/restaurants/${restaurantSlug}/${kind}`,
        { method: "POST", body: formData, credentials: "same-origin" },
      );
      if (handleExpiredSession(response)) return;
      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "بارگذاری تصویر ناموفق بود."),
        );
      }
      await fetchMenu();
      push(
        kind === "logo"
          ? "لوگوی کافه به‌روزرسانی شد."
          : "تصویر پس‌زمینه به‌روزرسانی شد.",
      );
    } catch (error) {
      setBrandError(
        error instanceof Error ? error.message : "بارگذاری تصویر ناموفق بود.",
      );
    } finally {
      setUploadingBranding(null);
    }
  };

  const removeBrandingImage = async (kind: BrandingKind) => {
    if (uploadingBranding) return;
    setUploadingBranding(kind);
    setBrandError(null);
    try {
      const response = await fetch(
        `/api/v1/restaurants/${restaurantSlug}/${kind}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      if (handleExpiredSession(response)) return;
      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "حذف تصویر ناموفق بود."),
        );
      }
      await fetchMenu();
      push(kind === "logo" ? "لوگوی کافه حذف شد." : "تصویر پس‌زمینه حذف شد.");
    } catch (error) {
      setBrandError(
        error instanceof Error ? error.message : "حذف تصویر ناموفق بود.",
      );
    } finally {
      setUploadingBranding(null);
    }
  };

  const uploadImageRequest = useCallback(
    async (itemKey: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        `/api/v1/restaurants/${restaurantSlug}/items/${encodeURIComponent(itemKey)}/image`,
        {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        },
      );

      if (handleExpiredSession(response)) return false;
      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "بارگذاری تصویر ناموفق بود."),
        );
      }
      return true;
    },
    [handleExpiredSession, restaurantSlug],
  );

  const selectImageFile = useCallback((file: File | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      previewUrlRef.current = objectUrl;
      setImagePreviewUrl(objectUrl);
    } else {
      setImagePreviewUrl(null);
    }
    setImageFile(file);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const resetForm = (prefillCategory?: string) => {
    setEditingItemKey(null);
    setName("");
    setCategory(
      prefillCategory && categoryNames.includes(prefillCategory)
        ? prefillCategory
        : (categoryNames[0] ?? ""),
    );
    setDescription("");
    setPriceToman("");
    setIsSpicy(false);
    selectImageFile(null);
    setFormError(null);
  };

  const openCreateModal = (prefillCategory?: string) => {
    resetForm(prefillCategory);
    setShowItemModal(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItemKey(item.id);
    setName(item.name);
    setCategory(item.category);
    setDescription(item.description);
    setPriceToman(item.price ? String(item.price.amount / 10) : "");
    setIsSpicy(item.is_spicy ?? false);
    selectImageFile(null);
    setFormError(null);
    setShowItemModal(true);
  };

  const closeItemModal = () => {
    if (saving) return;
    setShowItemModal(false);
    setEditingItemKey(null);
    selectImageFile(null);
    setFormError(null);
  };

  const handleSelectNewImage = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      selectImageFile(null);
      return;
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      selectImageFile(null);
      setFormError(validationError);
      event.target.value = "";
      return;
    }

    setFormError(null);
    selectImageFile(file);
  };

  const handleAddCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    const categoryName = newCategoryName.trim();
    if (!categoryName || categorySaving) return;

    setCategorySaving(true);
    setCategoryError(null);
    try {
      const response = await fetch(
        `/api/v1/restaurants/${restaurantSlug}/categories`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ name: categoryName }),
        },
      );
      if (handleExpiredSession(response)) return;
      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "افزودن دسته‌بندی ناموفق بود."),
        );
      }

      const savedCategory = (await response.json()) as { name: string };
      setMenu((currentMenu) =>
        currentMenu
          ? {
              ...currentMenu,
              categories: Array.from(
                new Set([
                  ...(currentMenu.categories ?? []),
                  savedCategory.name,
                ]),
              ),
            }
          : currentMenu,
      );
      setNewCategoryName("");
      setCategory(savedCategory.name);
      push(`دسته‌بندی «${savedCategory.name}» اضافه شد.`);
      await fetchMenu();
    } catch (error) {
      setCategoryError(
        error instanceof Error
          ? error.message
          : "افزودن دسته‌بندی ناموفق بود.",
      );
    } finally {
      setCategorySaving(false);
    }
  };

  const handleSubmitItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("نام آیتم را وارد کنید.");
      return;
    }
    const priceValue = Number.parseInt(priceToman, 10);
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setFormError("قیمت معتبر وارد کنید.");
      return;
    }
    if (!category || !categoryNames.includes(category)) {
      setFormError("لطفاً یک دسته‌بندی معتبر انتخاب کنید.");
      return;
    }

    setSaving(true);
    setFormError(null);
    const isEditing = editingItemKey !== null;
    const itemKey = editingItemKey ?? `item-${Date.now()}`;
    const selectedImage = imageFile;
    let itemSaved = false;

    try {
      const response = await fetch(
        isEditing
          ? `/api/v1/restaurants/${restaurantSlug}/items/${encodeURIComponent(itemKey)}`
          : `/api/v1/restaurants/${restaurantSlug}/items`,
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            ...(isEditing ? {} : { item_key: itemKey }),
            name: trimmedName,
            category,
            description: description.trim(),
            price_amount: priceValue * 10,
            is_spicy: isSpicy,
          }),
        },
      );

      if (handleExpiredSession(response)) return;
      if (!response.ok) {
        throw new Error(
          await getResponseError(
            response,
            isEditing ? "ویرایش آیتم ناموفق بود." : "افزودن آیتم ناموفق بود.",
          ),
        );
      }

      itemSaved = true;
      setShowItemModal(false);
      resetForm(category);
      push(isEditing ? "تغییرات آیتم ذخیره شد." : "آیتم جدید به منو اضافه شد.");

      if (selectedImage) {
        try {
          const uploaded = await uploadImageRequest(itemKey, selectedImage);
          if (!uploaded) return;
        } catch (error) {
          await fetchMenu();
          const reason =
            error instanceof Error
              ? error.message
              : "بارگذاری تصویر ناموفق بود.";
          push(
            `${isEditing ? "تغییرات" : "آیتم"} ذخیره شد، اما تصویر بارگذاری نشد. ${reason}`,
            "error",
          );
          setShowItemModal(false);
          return;
        }
      }

      await fetchMenu();
    } catch (error) {
      const fallback = isEditing
        ? "ویرایش آیتم ناموفق بود."
        : "افزودن آیتم ناموفق بود.";
      const message = error instanceof Error ? error.message : fallback;
      if (itemSaved) {
        push(message, "error");
      } else {
        setFormError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (itemKey: string, file: File) => {
    const validationError = validateImageFile(file);
    if (validationError) {
      push(validationError, "error");
      return;
    }

    setUploadingItemKey(itemKey);
    try {
      const uploaded = await uploadImageRequest(itemKey, file);
      if (!uploaded) return;
      await fetchMenu();
      push("تصویر آیتم به‌روزرسانی شد.");
    } catch (error) {
      push(
        error instanceof Error ? error.message : "بارگذاری تصویر ناموفق بود.",
        "error",
      );
    } finally {
      setUploadingItemKey(null);
    }
  };

  const confirmDeleteItem = async () => {
    if (!itemPendingDelete || deletingItem) return;

    const itemToDelete = itemPendingDelete;
    setDeletingItem(true);
    try {
      const response = await fetch(
        `/api/v1/restaurants/${restaurantSlug}/items/${encodeURIComponent(itemToDelete.id)}`,
        { method: "DELETE", credentials: "same-origin" },
      );

      if (handleExpiredSession(response)) return;
      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "حذف آیتم ناموفق بود."),
        );
      }

      setItemPendingDelete(null);
      push(`آیتم «${itemToDelete.name}» حذف شد.`);
      await fetchMenu();
    } catch (error) {
      push(
        error instanceof Error ? error.message : "حذف آیتم ناموفق بود.",
        "error",
      );
    } finally {
      setDeletingItem(false);
    }
  };

  const openCategoryDelete = (categoryName: string) => {
    const count = categoryCounts.get(categoryName) ?? 0;
    const otherCategories = categoryNames.filter(
      (name) => name !== categoryName,
    );
    setCategoryPendingDelete(categoryName);
    setCategoryDeleteError(null);
    setCategoryDeleteMode(
      count > 0 && otherCategories.length > 0 ? "move" : "delete_items",
    );
    setCategoryMoveTarget(otherCategories[0] ?? "");
  };

  const closeCategoryDelete = () => {
    if (deletingCategory) return;
    setCategoryPendingDelete(null);
    setCategoryDeleteError(null);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryPendingDelete || deletingCategory) return;

    const categoryName = categoryPendingDelete;
    const count = categoryCounts.get(categoryName) ?? 0;
    const params = new URLSearchParams();

    if (count > 0) {
      if (categoryDeleteMode === "move") {
        if (!categoryMoveTarget) {
          setCategoryDeleteError("دسته‌بندی مقصد را برای انتقال انتخاب کنید.");
          return;
        }
        params.set("strategy", "move");
        params.set("move_to", categoryMoveTarget);
      } else {
        params.set("strategy", "delete_items");
      }
    }

    const query = params.toString();
    setDeletingCategory(true);
    setCategoryDeleteError(null);
    try {
      const response = await fetch(
        `/api/v1/restaurants/${restaurantSlug}/categories/${encodeURIComponent(categoryName)}${query ? `?${query}` : ""}`,
        { method: "DELETE", credentials: "same-origin" },
      );

      if (handleExpiredSession(response)) return;
      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "حذف دسته‌بندی ناموفق بود."),
        );
      }

      setCategoryPendingDelete(null);
      if (count === 0) {
        push(`دسته‌بندی «${categoryName}» حذف شد.`);
      } else if (categoryDeleteMode === "move") {
        push(
          `دسته‌بندی «${categoryName}» حذف و ${formatNumber(count)} آیتم به «${categoryMoveTarget}» منتقل شد.`,
        );
      } else {
        push(
          `دسته‌بندی «${categoryName}» همراه با ${formatNumber(count)} آیتم حذف شد.`,
        );
      }
      await fetchMenu();
    } catch (error) {
      setCategoryDeleteError(
        error instanceof Error ? error.message : "حذف دسته‌بندی ناموفق بود.",
      );
    } finally {
      setDeletingCategory(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      const response = await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error("خروج از حساب ناموفق بود؛ دوباره تلاش کنید.");
      }
      router.replace("/login");
      router.refresh();
    } catch (error) {
      push(
        error instanceof Error ? error.message : "خروج از حساب ناموفق بود.",
        "error",
      );
      setLoggingOut(false);
    }
  };

  const copyMenuLink = async () => {
    const absoluteUrl = qrUrl.startsWith("http")
      ? qrUrl
      : `${window.location.origin}${qrUrl}`;
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      push("لینک منوی مشتری کپی شد.");
    } catch {
      push("کپی لینک ممکن نشد؛ لطفاً لینک را دستی کپی کنید.", "error");
    }
  };

  const categoryPendingCount = categoryPendingDelete
    ? (categoryCounts.get(categoryPendingDelete) ?? 0)
    : 0;
  const otherCategories = categoryNames.filter(
    (categoryName) => categoryName !== categoryPendingDelete,
  );

  return (
    <div className="min-h-screen overflow-x-clip pb-24 lg:pb-16">
      <header className="sticky top-0 z-40 border-b border-line/60 bg-canvas/80 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary text-on-primary shadow-md shadow-primary/25">
              {menu?.logo_url ? (
                <NextImage
                  src={menu.logo_url}
                  alt="لوگوی کافه"
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <Coffee className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <h1 className="max-w-[9.5rem] truncate text-[13px] font-black sm:max-w-none sm:text-sm">
                {menu?.restaurant_name ?? "پنل مدیریت کافه"}
              </h1>
              <p
                className="hidden truncate text-[10px] text-ink-faint sm:block"
                dir="ltr"
                title={ownerEmail}
              >
                {ownerEmail}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              href={`/r/${restaurantSlug}`}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-2 text-[11px] font-bold text-ink-soft shadow-sm transition-colors hover:border-primary/40 hover:text-primary md:inline-flex"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              پیش‌نمایش منو
            </Link>
            <ThemeSwitcher />
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="خروج از حساب"
              title="خروج از حساب"
              className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-ink-soft shadow-sm transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50 sm:h-10 sm:w-10"
            >
              {loggingOut ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:py-6 print:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
              پنل صاحب کافه
            </p>
            <h2 className="mt-1 text-xl font-black">مدیریت منو</h2>
            <p className="mt-1 max-w-lg text-[11px] leading-5 text-ink-soft">
              دسته‌بندی‌ها و آیتم‌ها را همین‌جا مدیریت کنید؛ تغییرات همان لحظه
              در منوی مشتری دیده می‌شود.
            </p>
          </div>
          <div className="flex gap-2 sm:justify-end">
            <Link
              href={`/r/${restaurantSlug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface px-3 py-3 text-[11px] font-bold text-ink-soft shadow-sm transition-colors hover:border-primary/40 hover:text-primary sm:flex-none md:hidden"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              پیش‌نمایش
            </Link>
            <button
              type="button"
              onClick={() => openCreateModal()}
              disabled={categoryNames.length === 0}
              title={
                categoryNames.length === 0
                  ? "ابتدا یک دسته‌بندی بسازید"
                  : "افزودن آیتم جدید"
              }
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 py-3 text-[11px] font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary-strong active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              افزودن آیتم جدید
            </button>
          </div>
        </div>

        {actionError && (
          <div
            role="alert"
            className="flex flex-col items-start gap-3 rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-[11px] font-bold text-danger sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="flex items-start gap-2">
              <CircleAlert
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              {actionError}
            </span>
            <button
              type="button"
              onClick={() => void fetchMenu()}
              className="rounded-xl border border-danger/30 bg-surface px-3 py-1.5 text-[10px] font-bold text-danger transition-colors hover:bg-danger/10"
            >
              تلاش دوباره
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatCard
            icon={UtensilsCrossed}
            label="آیتم‌های منو"
            value={items.length}
          />
          <StatCard icon={Tags} label="دسته‌بندی‌ها" value={categoryNames.length} />
          <StatCard
            icon={ImageIcon}
            label="دارای تصویر"
            value={items.filter((item) => Boolean(item.image_url)).length}
          />
          <StatCard
            icon={Flame}
            label="آیتم تند"
            value={items.filter((item) => item.is_spicy).length}
          />
        </div>

        {/* در موبایل فقط یک بخش در هر لحظه؛ در دسکتاپ هر دو ستون */}
        <div className="sticky top-16 z-30 rounded-2xl border border-line/60 bg-canvas/95 p-1.5 backdrop-blur-xl lg:hidden">
          <div
            role="tablist"
            aria-label="بخش‌های پنل"
            className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-muted p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mobilePanel === "menu"}
              onClick={() => setMobilePanel("menu")}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-bold transition-colors",
                mobilePanel === "menu"
                  ? "bg-surface text-primary shadow-sm"
                  : "text-ink-soft",
              )}
            >
              <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
              منو
              <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-[9px] font-black text-primary tabular-nums">
                {formatNumber(items.length)}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobilePanel === "settings"}
              onClick={() => setMobilePanel("settings")}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-bold transition-colors",
                mobilePanel === "settings"
                  ? "bg-surface text-primary shadow-sm"
                  : "text-ink-soft",
              )}
            >
              <Store className="h-4 w-4" aria-hidden="true" />
              مدیریت کافه
            </button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
          <section
            className={cn(
              "order-2 min-w-0 overflow-visible rounded-3xl border border-line bg-surface shadow-card lg:order-1",
              mobilePanel !== "menu" && "hidden lg:block",
            )}
          >
            <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
              <div className="min-w-0">
                <h3 className="text-sm font-black">آیتم‌های منو</h3>
                <p className="mt-0.5 text-[10px] text-ink-faint">
                  {formatNumber(items.length)} آیتم در{" "}
                  {formatNumber(categoryNames.length)} دسته‌بندی
                </p>
              </div>
              <button
                type="button"
                onClick={() => openCreateModal()}
                disabled={categoryNames.length === 0}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-line bg-surface-muted px-2.5 py-2 text-[10px] font-bold text-ink-soft transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50 sm:px-3"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                آیتم جدید
              </button>
            </div>

            <MenuCategoryNav
              categories={categoryList}
              totalCount={items.length}
              active={activeCategory}
              onSelect={scrollToCategory}
              navRef={navRef}
              tone="surface"
              sticky
              topClassName="top-[7.5rem] lg:top-16"
              className="border-y border-line/60"
              containerClassName="flex items-center gap-2 px-4 py-2.5 sm:px-5"
              action={
                <button
                  type="button"
                  onClick={() => openCreateModal(activeCategory ?? undefined)}
                  disabled={categoryNames.length === 0}
                  aria-label="افزودن آیتم جدید"
                  title="افزودن آیتم جدید"
                  className="grid h-9 w-9 place-items-center rounded-full bg-primary text-on-primary shadow-md shadow-primary/20 transition-colors hover:bg-primary-strong disabled:opacity-50 md:hidden"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              }
            />

            <div ref={menuRef} className="space-y-7 p-4 sm:p-5">
              {categoryNames.length === 0 && (
                <div className="rounded-2xl border border-dashed border-line bg-surface-muted/50 p-8 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary">
                    <Tags className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h4 className="mt-3 text-xs font-black">
                    ابتدا یک دسته‌بندی بسازید
                  </h4>
                  <p className="mt-1 text-[10px] leading-5 text-ink-faint">
                    برای افزودن آیتم، ابتدا در بخش «دسته‌بندی‌ها» یک دسته
                    ایجاد کنید.
                  </p>
                </div>
              )}

              {categoryNames.map((categoryName) => {
                const categoryItems = items.filter(
                  (item) => item.category === categoryName,
                );
                return (
                  <section
                    key={categoryName}
                    data-category-name={categoryName}
                    className="scroll-mt-48 space-y-3 lg:scroll-mt-36"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-surface-muted text-primary">
                        <Tags className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <h4 className="text-xs font-black">{categoryName}</h4>
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[9px] font-bold text-ink-faint">
                        {formatNumber(categoryItems.length)} آیتم
                      </span>
                      <span className="h-px flex-1 bg-line" aria-hidden="true" />
                    </div>

                    {categoryItems.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-surface-muted/40 px-4 py-5 text-center">
                        <p className="text-[10px] text-ink-faint">
                          هنوز آیتمی در این دسته‌بندی نیست.
                        </p>
                        <button
                          type="button"
                          onClick={() => openCreateModal(categoryName)}
                          className="inline-flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1.5 text-[10px] font-bold text-primary shadow-sm transition-colors hover:bg-primary-soft"
                        >
                          <Plus className="h-3 w-3" aria-hidden="true" />
                          افزودن آیتم
                        </button>
                      </div>
                    ) : (
                      categoryItems.map((item) => (
                        <article
                          key={item.id}
                          className="group flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-line-strong sm:flex-row sm:items-center"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-line/60 bg-surface-muted">
                              {item.image_url ? (
                                <NextImage
                                  src={item.image_url}
                                  alt={item.name}
                                  width={128}
                                  height={128}
                                  unoptimized
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="grid h-full place-items-center text-ink-faint">
                                  <ImageIcon
                                    className="h-5 w-5"
                                    aria-hidden="true"
                                  />
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h5 className="min-w-0 break-words text-xs font-black">
                                  {item.name}
                                </h5>
                                {item.is_spicy && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-danger-soft px-1.5 py-0.5 text-[9px] font-bold text-danger">
                                    <Flame
                                      className="h-2.5 w-2.5"
                                      aria-hidden="true"
                                    />
                                    تند
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 line-clamp-1 break-words text-[10px] text-ink-soft">
                                {item.description || "بدون توضیحات"}
                              </p>
                              <div className="mt-1.5 flex flex-wrap items-baseline gap-1">
                                <span className="text-xs font-black text-primary">
                                  {formatItemPrice(item.price)}
                                </span>
                                <span className="text-[9px] font-bold text-ink-faint">
                                  تومان
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-1 border-t border-line/70 pt-2 sm:border-0 sm:pt-0">
                            <label
                              className={cn(
                                "inline-flex cursor-pointer items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-bold text-ink-soft transition-colors hover:bg-surface-muted hover:text-primary",
                                uploadingItemKey === item.id &&
                                  "pointer-events-none opacity-50",
                              )}
                              title={
                                item.image_url ? "تغییر تصویر" : "افزودن تصویر"
                              }
                            >
                              {uploadingItemKey === item.id ? (
                                <LoaderCircle
                                  className="h-3.5 w-3.5 animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <ImagePlus
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="hidden sm:inline">
                                {uploadingItemKey === item.id
                                  ? "در حال بارگذاری"
                                  : item.image_url
                                    ? "تصویر"
                                    : "افزودن تصویر"}
                              </span>
                              <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                                className="sr-only"
                                disabled={uploadingItemKey === item.id}
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  event.target.value = "";
                                  if (file) void handleImageUpload(item.id, file);
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              aria-label={`ویرایش ${item.name}`}
                              title="ویرایش آیتم"
                              className="inline-flex items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-bold text-ink-soft transition-colors hover:bg-surface-muted hover:text-primary"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="hidden sm:inline">ویرایش</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setItemPendingDelete(item)}
                              aria-label={`حذف ${item.name}`}
                              title="حذف آیتم"
                              className="inline-flex items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-bold text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="hidden sm:inline">حذف</span>
                            </button>
                          </div>
                        </article>
                      ))
                    )}
                  </section>
                );
              })}
            </div>
          </section>

          <aside
            className={cn(
              "order-1 min-w-0 space-y-4 lg:order-2 lg:sticky lg:top-20",
              mobilePanel !== "settings" && "hidden lg:block",
            )}
          >
            <section className="rounded-3xl border border-line bg-surface shadow-card">
              <div className="flex items-center gap-2.5 border-b border-line/60 px-4 py-3.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Store className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-black">هویت کافه</h3>
                  <p className="text-[10px] text-ink-faint">
                    نام، لوگو و پس‌زمینهٔ صفحهٔ مشتری
                  </p>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <form onSubmit={saveBrandName} className="space-y-1.5">
                  <label
                    htmlFor="brand-name"
                    className="text-[10px] font-bold text-ink-soft"
                  >
                    نام کافه یا رستوران
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="brand-name"
                      type="text"
                      value={brandName}
                      onChange={(event) => setBrandName(event.target.value)}
                      maxLength={100}
                      disabled={savingBrandName}
                      placeholder="کافه رستوران ونوشه"
                      className="min-w-0 flex-1 rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-[11px] text-ink outline-none transition-all placeholder:text-ink-faint focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={
                        savingBrandName ||
                        !brandName.trim() ||
                        brandName.trim() === menu?.restaurant_name
                      }
                      title="ذخیرهٔ نام کافه"
                      className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-2.5 text-[10px] font-bold text-on-primary transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingBrandName ? (
                        <LoaderCircle
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      ذخیره
                    </button>
                  </div>
                  <p className="text-[10px] leading-5 text-ink-faint">
                    این نام در سرصفحهٔ منوی مشتری و روی برگهٔ QR دیده می‌شود.
                  </p>
                </form>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-ink-soft">لوگوی کافه</p>
                  <div className="flex items-center gap-2.5">
                    <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-surface-muted">
                      {menu?.logo_url ? (
                        <NextImage
                          src={menu.logo_url}
                          alt="لوگوی کافه"
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <ImageIcon
                          className="h-5 w-5 text-ink-faint"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      <label
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-1 rounded-xl border border-line bg-surface-muted px-2.5 py-2 text-[10px] font-bold text-ink-soft transition-colors hover:border-primary/40 hover:text-primary",
                          uploadingBranding === "logo" &&
                            "pointer-events-none opacity-50",
                        )}
                      >
                        {uploadingBranding === "logo" ? (
                          <LoaderCircle
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <ImagePlus
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        )}
                        {menu?.logo_url ? "تغییر لوگو" : "بارگذاری لوگو"}
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                          className="sr-only"
                          disabled={uploadingBranding !== null}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file) void uploadBrandingImage("logo", file);
                          }}
                        />
                      </label>
                      {menu?.logo_url && (
                        <button
                          type="button"
                          onClick={() => void removeBrandingImage("logo")}
                          disabled={uploadingBranding !== null}
                          className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-[10px] font-bold text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                        >
                          <Trash2
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          حذف
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] leading-5 text-ink-faint">
                    مربع‌ترین تصویر بهترین نتیجه را می‌دهد (حداکثر ۵ مگابایت).
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-ink-soft">
                    تصویر پس‌زمینهٔ صفحهٔ مشتری
                  </p>
                  <div className="relative grid h-24 w-full place-items-center overflow-hidden rounded-2xl border border-line bg-surface-muted">
                    {menu?.background_url ? (
                      <NextImage
                        src={menu.background_url}
                        alt="پس‌زمینهٔ صفحهٔ مشتری"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-[10px] font-bold text-ink-faint">
                        بدون تصویر پس‌زمینه
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <label
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1 rounded-xl border border-line bg-surface-muted px-2.5 py-2 text-[10px] font-bold text-ink-soft transition-colors hover:border-primary/40 hover:text-primary",
                        uploadingBranding === "background" &&
                          "pointer-events-none opacity-50",
                      )}
                    >
                      {uploadingBranding === "background" ? (
                        <LoaderCircle
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {menu?.background_url
                        ? "تغییر پس‌زمینه"
                        : "بارگذاری پس‌زمینه"}
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={uploadingBranding !== null}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file)
                            void uploadBrandingImage("background", file);
                        }}
                      />
                    </label>
                    {menu?.background_url && (
                      <button
                        type="button"
                        onClick={() => void removeBrandingImage("background")}
                        disabled={uploadingBranding !== null}
                        className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-[10px] font-bold text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        حذف
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] leading-5 text-ink-faint">
                    عکس افقی از فضای کافه، کم‌کنتراست و تیره انتخاب کنید تا متن
                    منو خوانا بماند.
                  </p>
                </div>

                {brandError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-danger/25 bg-danger-soft px-2.5 py-2 text-[10px] font-bold text-danger"
                  >
                    {brandError}
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-line bg-surface shadow-card">
              <div className="flex items-center gap-2.5 border-b border-line/60 px-4 py-3.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Info className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-black">دربارهٔ مجموعه</h3>
                  <p className="text-[10px] text-ink-faint">
                    دستیار هوشمند این توضیحات را هم می‌خواند
                  </p>
                </div>
              </div>

              <form onSubmit={saveAbout} className="space-y-3 p-4">
                <label
                  htmlFor="about-text"
                  className="text-[10px] font-bold text-ink-soft"
                >
                  معرفی کافه یا رستوران
                </label>
                <textarea
                  id="about-text"
                  value={aboutText}
                  onChange={(event) => {
                    setAboutText(event.target.value);
                    setAboutError(null);
                  }}
                  rows={6}
                  maxLength={1500}
                  disabled={savingAbout}
                  dir="rtl"
                  placeholder={
                    "مثلاً: کافه‌ای دنج با فضای باز و تراس، مناسب کار و مطالعه.\nپارکینگ رایگان، اینترنت پرسرعت و منوی گیاهی داریم.\nساعت کاری: ۹ صبح تا ۲۳ شب."
                  }
                  className="w-full resize-y rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-[11px] leading-6 text-ink outline-none transition-all placeholder:text-ink-faint focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-60"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] tabular-nums text-ink-faint">
                    {formatNumber(aboutText.length)} / ۱۵۰۰
                  </span>
                  <button
                    type="submit"
                    disabled={
                      savingAbout || aboutText === (menu?.restaurant_about ?? "")
                    }
                    className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2.5 text-[10px] font-bold text-on-primary transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingAbout ? (
                      <LoaderCircle
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    ذخیرهٔ توضیحات
                  </button>
                </div>

                {aboutError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-danger/25 bg-danger-soft px-2.5 py-2 text-[10px] font-bold text-danger"
                  >
                    {aboutError}
                  </p>
                )}

                <p className="text-[10px] leading-5 text-ink-faint">
                  هر چیزی که دوست دارید مشتری بداند اینجا بنویسید: ساعت کاری،
                  آدرس، فضا، پارکینگ، رزرو، منوی گیاهی و مانند آن. اگر پاسخی در
                  این متن نباشد، دستیار حدس نمی‌زند و مشتری را به پرسنل ارجاع
                  می‌دهد.
                </p>
              </form>
            </section>

            <section className="rounded-3xl border border-line bg-surface shadow-card">
              <div className="flex items-center gap-2.5 border-b border-line/60 px-4 py-3.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Tags className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-black">دسته‌بندی‌ها</h3>
                  <p className="text-[10px] text-ink-faint">
                    {formatNumber(categoryNames.length)} دسته‌بندی ساخته‌شده
                  </p>
                </div>
              </div>

              <div className="space-y-3 p-4">
                <form onSubmit={handleAddCategory} className="flex gap-2">
                  <input
                    type="text"
                    aria-label="نام دسته‌بندی جدید"
                    placeholder="نام دسته جدید؛ مثلاً صبحانه"
                    value={newCategoryName}
                    onChange={(event) => {
                      setNewCategoryName(event.target.value);
                      setCategoryError(null);
                    }}
                    maxLength={50}
                    required
                    className="min-w-0 flex-1 rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-[11px] text-ink outline-none transition-all placeholder:text-ink-faint focus:border-primary focus:ring-4 focus:ring-primary/15"
                  />
                  <button
                    type="submit"
                    disabled={categorySaving || !newCategoryName.trim()}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-2.5 text-[10px] font-bold text-on-primary transition-colors hover:bg-primary-strong disabled:opacity-50"
                  >
                    {categorySaving ? (
                      <LoaderCircle
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    افزودن
                  </button>
                </form>

                {categoryError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-danger/25 bg-danger-soft px-2.5 py-1.5 text-[10px] font-bold text-danger"
                  >
                    {categoryError}
                  </p>
                )}

                {categoryNames.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line bg-surface-muted/50 px-3 py-4 text-center text-[10px] text-ink-faint">
                    هنوز دسته‌بندی‌ای نساخته‌اید؛ با فرم بالا شروع کنید.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {categoryNames.map((categoryName) => {
                      const count = categoryCounts.get(categoryName) ?? 0;
                      return (
                        <li
                          key={categoryName}
                          className="flex items-center gap-2 rounded-xl border border-line/70 bg-surface-muted/50 px-2.5 py-2"
                        >
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-surface text-[9px] font-black text-ink-soft shadow-sm">
                            {formatNumber(count)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-ink">
                            {categoryName}
                          </span>
                          <button
                            type="button"
                            onClick={() => openCategoryDelete(categoryName)}
                            aria-label={`حذف دسته‌بندی ${categoryName}`}
                            title="حذف دسته‌بندی"
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <p className="text-[10px] leading-5 text-ink-faint">
                  با حذف دسته، می‌توانید آیتم‌هایش را به دسته دیگری منتقل کنید
                  یا همراه آن‌ها حذف کنید.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-line bg-surface shadow-card">
              <div className="flex items-center gap-2.5 border-b border-line/60 px-4 py-3.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
                  <QrCode className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-black">کد QR میزها</h3>
                  <p className="text-[10px] text-ink-faint">
                    اسکن مشتری، منو را باز می‌کند
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3 p-4">
                <div className="rounded-2xl border border-line bg-white p-3 shadow-sm">
                  <QRCodeSVG
                    value={qrUrl}
                    size={148}
                    bgColor="#ffffff"
                    fgColor="#111827"
                    level="M"
                  />
                </div>
                <p className="text-center text-[10px] leading-5 text-ink-faint">
                  این کد را روی میزها قرار دهید تا مشتری بدون نصب اپلیکیشن منو
                  را ببیند.
                </p>
                <div className="grid w-full grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-line bg-surface-muted px-2 py-2 text-[10px] font-bold text-ink-soft transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                    پرینت
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyMenuLink()}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-line bg-surface-muted px-2 py-2 text-[10px] font-bold text-ink-soft transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    کپی لینک
                  </button>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>

      {/* --- فرم افزودن یا ویرایش آیتم --- */}
      <Modal
        open={showItemModal}
        onClose={closeItemModal}
        labelledBy="item-form-title"
        placement="sheet"
        className="sm:max-w-md"
      >
        <form onSubmit={handleSubmitItem}>
          <div className="flex items-center gap-3 border-b border-line/60 px-5 pb-4 pt-5 pe-14">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
              {editingItemKey ? (
                <Pencil className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <h2 id="item-form-title" className="text-sm font-black">
                {editingItemKey ? "ویرایش آیتم" : "افزودن آیتم جدید"}
              </h2>
              <p className="mt-0.5 text-[10px] text-ink-faint">
                {editingItemKey
                  ? "تغییرات پس از ذخیره در منوی مشتری نمایش داده می‌شود."
                  : "آیتم جدید بلافاصله در منوی مشتری قابل مشاهده است."}
              </p>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="space-y-1.5">
              <label
                htmlFor="item-name"
                className="text-[11px] font-bold text-ink-soft"
              >
                نام آیتم <span className="text-danger">*</span>
              </label>
              <input
                id="item-name"
                type="text"
                placeholder="مثلاً لاته"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                required
                className="w-full rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-[11px] text-ink outline-none transition-all placeholder:text-ink-faint focus:border-primary focus:ring-4 focus:ring-primary/15"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-ink-soft">
                دسته‌بندی <span className="text-danger">*</span>
              </span>
              {categoryNames.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line bg-surface-muted/50 px-3 py-3 text-[10px] text-ink-faint">
                  هنوز دسته‌بندی‌ای نساخته‌اید. ابتدا از بخش «دسته‌بندی‌ها» یک
                  دسته بسازید.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {categoryNames.map((categoryName) => (
                    <button
                      key={categoryName}
                      type="button"
                      onClick={() => setCategory(categoryName)}
                      aria-pressed={category === categoryName}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[10px] font-bold transition-colors",
                        category === categoryName
                          ? "border-transparent bg-primary text-on-primary shadow-sm"
                          : "border-line bg-surface text-ink-soft hover:border-primary/40 hover:text-ink",
                      )}
                    >
                      {categoryName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="item-description"
                className="text-[11px] font-bold text-ink-soft"
              >
                توضیحات و ترکیبات
              </label>
              <textarea
                id="item-description"
                placeholder="ترکیبات، طعم و هر نکته‌ای که مشتری باید بداند..."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
                className="h-20 w-full resize-none rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-[11px] leading-5 text-ink outline-none transition-all placeholder:text-ink-faint focus:border-primary focus:ring-4 focus:ring-primary/15"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="item-price"
                className="text-[11px] font-bold text-ink-soft"
              >
                قیمت (تومان) <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <input
                  id="item-price"
                  type="number"
                  placeholder="۱۴۵۰۰۰"
                  value={priceToman}
                  onChange={(event) => setPriceToman(event.target.value)}
                  min="0"
                  required
                  className="w-full rounded-xl border border-line bg-surface-muted py-2.5 pe-16 ps-3 text-[11px] text-ink outline-none transition-all placeholder:text-ink-faint focus:border-primary focus:ring-4 focus:ring-primary/15"
                />
                <span className="pointer-events-none absolute end-3 top-2.5 text-[10px] font-bold text-ink-faint">
                  تومان
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-ink-soft">
                تصویر آیتم (اختیاری)
              </span>
              <label
                htmlFor="item-image"
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-line bg-surface-muted/50 p-3 transition-colors hover:border-primary/50"
              >
                <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-surface text-ink-faint">
                  {imageFile && imagePreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagePreviewUrl}
                      alt="پیش‌نمایش تصویر آیتم"
                      className="h-full w-full object-cover"
                    />
                  ) : editingItem?.image_url ? (
                    <NextImage
                      src={editingItem.image_url}
                      alt={editingItem.name}
                      width={96}
                      height={96}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-5 w-5" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-bold text-ink">
                    {imageFile
                      ? imageFile.name
                      : editingItem?.image_url
                        ? "تصویر فعلی آیتم"
                        : "انتخاب تصویر برای آیتم"}
                  </span>
                  <span className="mt-0.5 block text-[9px] text-ink-faint">
                    JPG، PNG یا WebP؛ حداکثر ۵ مگابایت
                  </span>
                </span>
                <span className="shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[10px] font-bold text-primary">
                  انتخاب
                </span>
                <input
                  id="item-image"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={handleSelectNewImage}
                  className="sr-only"
                />
              </label>
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-line bg-surface-muted/50 px-3.5 py-3">
              <span className="flex items-center gap-2 text-[11px] font-bold text-ink-soft">
                <Flame className="h-4 w-4 text-danger" aria-hidden="true" />
                طعم تند دارد
              </span>
              <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
                <input
                  type="checkbox"
                  checked={isSpicy}
                  onChange={(event) => setIsSpicy(event.target.checked)}
                  className="peer sr-only"
                  aria-label="طعم تند دارد"
                />
                <span className="absolute inset-0 rounded-full bg-line transition-colors peer-checked:bg-primary" />
                <span className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:-translate-x-5" />
              </span>
            </label>

            {formError && (
              <p
                role="alert"
                className="rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-[10px] font-bold leading-5 text-danger"
              >
                {formError}
              </p>
            )}
          </div>

          <div className="sticky bottom-0 flex gap-2 border-t border-line/60 bg-surface/95 px-5 py-3.5 backdrop-blur">
            <button
              type="submit"
              disabled={saving || categoryNames.length === 0}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[11px] font-bold text-on-primary transition-colors hover:bg-primary-strong disabled:opacity-50"
            >
              {saving && (
                <LoaderCircle
                  className="h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
              )}
              {saving
                ? "در حال ذخیره..."
                : editingItemKey
                  ? "ذخیره تغییرات"
                  : "ذخیره آیتم"}
            </button>
            <button
              type="button"
              onClick={closeItemModal}
              disabled={saving}
              className="rounded-xl border border-line bg-surface px-4 py-2.5 text-[11px] font-bold text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-50"
            >
              انصراف
            </button>
          </div>
        </form>
      </Modal>

      {/* --- تأیید حذف آیتم --- */}
      <Modal
        open={itemPendingDelete !== null}
        onClose={() => !deletingItem && setItemPendingDelete(null)}
        labelledBy="delete-item-title"
        placement="sheet"
        showClose={false}
        className="max-w-sm"
      >
        <div className="p-5 pt-7 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-danger-soft text-danger">
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 id="delete-item-title" className="mt-3 text-sm font-black">
            حذف آیتم از منو
          </h2>
          <p className="mt-2 text-[11px] leading-6 text-ink-soft">
            آیا از حذف «{itemPendingDelete?.name}» اطمینان دارید؟ این عمل قابل
            بازگشت نیست.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => void confirmDeleteItem()}
              disabled={deletingItem}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-danger px-4 py-2.5 text-[11px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {deletingItem && (
                <LoaderCircle
                  className="h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
              )}
              {deletingItem ? "در حال حذف..." : "حذف آیتم"}
            </button>
            <button
              type="button"
              onClick={() => setItemPendingDelete(null)}
              disabled={deletingItem}
              className="rounded-xl border border-line bg-surface px-4 py-2.5 text-[11px] font-bold text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-50"
            >
              انصراف
            </button>
          </div>
        </div>
      </Modal>

      {/* --- تأیید حذف دسته‌بندی --- */}
      <Modal
        open={categoryPendingDelete !== null}
        onClose={closeCategoryDelete}
        labelledBy="delete-category-title"
        placement="sheet"
        showClose={false}
        className="max-w-md"
      >
        <div className="p-5 pt-7">
          <div className="text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-danger-soft text-danger">
              <Trash2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 id="delete-category-title" className="mt-3 text-sm font-black">
              حذف دسته‌بندی «{categoryPendingDelete}»
            </h2>
            <p className="mt-2 text-[11px] leading-6 text-ink-soft">
              {categoryPendingCount === 0
                ? "این دسته‌بندی خالی است؛ با حذف آن هیچ آیتمی پاک نمی‌شود."
                : `این دسته‌بندی ${formatNumber(categoryPendingCount)} آیتم دارد. مشخص کنید آیتم‌ها چه شوند.`}
            </p>
          </div>

          {categoryPendingCount > 0 && (
            <div className="mt-4 space-y-2">
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3 transition-colors",
                  categoryDeleteMode === "move"
                    ? "border-primary bg-primary-soft"
                    : "border-line bg-surface-muted/50",
                  otherCategories.length === 0 &&
                    "cursor-not-allowed opacity-50",
                )}
              >
                <input
                  type="radio"
                  name="category-delete-strategy"
                  value="move"
                  checked={categoryDeleteMode === "move"}
                  onChange={() => setCategoryDeleteMode("move")}
                  disabled={otherCategories.length === 0}
                  className="mt-0.5 h-3.5 w-3.5 accent-[var(--primary)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold">
                    انتقال آیتم‌ها به دسته دیگر
                  </span>
                  <span className="mt-0.5 block text-[10px] text-ink-faint">
                    آیتم‌ها و تصاویرشان حفظ می‌شوند و فقط دسته‌بندی حذف می‌شود.
                  </span>
                  {categoryDeleteMode === "move" &&
                    otherCategories.length > 0 && (
                      <select
                        value={categoryMoveTarget}
                        onChange={(event) =>
                          setCategoryMoveTarget(event.target.value)
                        }
                        aria-label="دسته‌بندی مقصد"
                        className="mt-2 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-[10px] font-bold text-ink outline-none focus:border-primary"
                      >
                        {otherCategories.map((categoryName) => (
                          <option key={categoryName} value={categoryName}>
                            {categoryName}
                          </option>
                        ))}
                      </select>
                    )}
                </span>
              </label>

              <label
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3 transition-colors",
                  categoryDeleteMode === "delete_items"
                    ? "border-danger bg-danger-soft"
                    : "border-line bg-surface-muted/50",
                )}
              >
                <input
                  type="radio"
                  name="category-delete-strategy"
                  value="delete_items"
                  checked={categoryDeleteMode === "delete_items"}
                  onChange={() => setCategoryDeleteMode("delete_items")}
                  className="mt-0.5 h-3.5 w-3.5 accent-[var(--danger)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold">
                    حذف دسته‌بندی همراه با همه آیتم‌هایش
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-5 text-ink-faint">
                    {formatNumber(categoryPendingCount)} آیتم و تصاویرشان برای
                    همیشه حذف می‌شوند.
                  </span>
                </span>
              </label>

              {otherCategories.length === 0 && (
                <p className="flex items-start gap-1.5 rounded-xl border border-warning/30 bg-warning-soft px-2.5 py-2 text-[10px] font-bold leading-5 text-warning">
                  <TriangleAlert
                    className="mt-0.5 h-3 w-3 shrink-0"
                    aria-hidden="true"
                  />
                  دسته دیگری وجود ندارد؛ برای انتقال آیتم‌ها ابتدا یک دسته جدید
                  بسازید.
                </p>
              )}
            </div>
          )}

          {categoryDeleteError && (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-[10px] font-bold text-danger"
            >
              {categoryDeleteError}
            </p>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => void confirmDeleteCategory()}
              disabled={deletingCategory}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-danger px-4 py-2.5 text-[11px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {deletingCategory && (
                <LoaderCircle
                  className="h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
              )}
              {deletingCategory ? "در حال حذف..." : "حذف دسته‌بندی"}
            </button>
            <button
              type="button"
              onClick={closeCategoryDelete}
              disabled={deletingCategory}
              className="rounded-xl border border-line bg-surface px-4 py-2.5 text-[11px] font-bold text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-50"
            >
              انصراف
            </button>
          </div>
        </div>
      </Modal>

      {/* دکمهٔ شناور افزودن آیتم برای موبایل */}
      <button
        type="button"
        onClick={() => openCreateModal()}
        disabled={categoryNames.length === 0}
        className="fixed bottom-5 left-4 z-40 inline-flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-3 text-[11px] font-bold text-on-primary shadow-lg shadow-primary/30 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 lg:hidden print:hidden"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        آیتم جدید
      </button>

      <ToastViewport toasts={toasts} onDismiss={dismiss} />

      {/* نسخهٔ مخصوص پرینت کد QR */}
      <div className="hidden print:block">
        <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
          <p className="text-2xl font-black">{menu?.restaurant_name}</p>
          <p className="text-sm">منوی دیجیتال کافه · برای مشاهدهٔ منو اسکن کنید</p>
          <div className="rounded-2xl border border-slate-300 p-6">
            <QRCodeSVG
              value={qrUrl}
              size={260}
              bgColor="#ffffff"
              fgColor="#111827"
              level="M"
            />
          </div>
          <p className="text-xs text-slate-600" dir="ltr">
            {qrUrl}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Coffee className="h-4 w-4" />
            {restaurantInitial(menu?.restaurant_name)} · دستیار هوشمند کافه
          </p>
        </div>
      </div>
    </div>
  );
}

