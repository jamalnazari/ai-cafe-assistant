"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * فعال‌سازی هم‌زمان دو رفتار برای نوار دسته‌بندی‌ها:
 * ۱. انتخاب دسته با کلیک، بخش مربوطه را به زیر نوار می‌آورد.
 * ۲. با اسکرول کردن کاربر، دسته‌ای که در حال نمایش است در نوار مشخص می‌شود.
 */
export function useCategoryScrollSpy(categories: string[]) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const lockUntilRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const categoriesKey = categories.join("\u0000");

  // اگر دسته‌بندی فعال حذف شود، نوار به حالت «همه موارد» برمی‌گردد.
  const visibleActiveCategory =
    activeCategory && categories.includes(activeCategory)
      ? activeCategory
      : null;

  const updateActiveCategory = useCallback(() => {
    if (typeof window === "undefined") return;
    if (performance.now() < lockUntilRef.current) return;

    const menu = menuRef.current;
    if (!menu) {
      setActiveCategory(null);
      return;
    }

    const sections = Array.from(
      menu.querySelectorAll<HTMLElement>("[data-category-name]"),
    );
    if (sections.length === 0) {
      setActiveCategory(null);
      return;
    }

    const threshold =
      (navRef.current?.getBoundingClientRect().bottom ?? 0) + 12;
    let current: string | null = null;
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= threshold) {
        current = section.dataset.categoryName ?? null;
      } else {
        break;
      }
    }

    // در انتهای صفحه، آخرین دسته‌بندی فعال می‌ماند تا نوار با محتوا هماهنگ باشد.
    // در صفحه‌های کوتاه که اسکرول ندارند، این قاعده اعمال نمی‌شود.
    const isScrollable =
      document.documentElement.scrollHeight - window.innerHeight > 80;
    const atPageBottom =
      isScrollable &&
      window.scrollY > 24 &&
      window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 8;
    if (atPageBottom) {
      current =
        sections[sections.length - 1]?.dataset.categoryName ?? current;
    }

    setActiveCategory(current);
  }, []);

  const requestUpdate = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      updateActiveCategory();
    });
  }, [updateActiveCategory]);

  useEffect(() => {
    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(requestUpdate);
    if (observer) {
      if (menuRef.current) observer.observe(menuRef.current);
      if (navRef.current) observer.observe(navRef.current);
    }

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      observer?.disconnect();
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [requestUpdate, categoriesKey]);

  const scrollToCategory = useCallback((categoryName: string | null) => {
    const menu = menuRef.current;
    if (!menu) return;

    const navBottom = navRef.current?.getBoundingClientRect().bottom ?? 0;
    let target: HTMLElement | null = menu;
    if (categoryName) {
      const escaped =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(categoryName)
          : categoryName.replace(/"/g, '\\"');
      target = menu.querySelector<HTMLElement>(
        `[data-category-name="${escaped}"]`,
      );
    }
    if (!target) return;

    const top =
      window.scrollY + target.getBoundingClientRect().top - navBottom - 12;
    lockUntilRef.current = performance.now() + 900;
    setActiveCategory(categoryName);
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, []);

  return {
    activeCategory: visibleActiveCategory,
    setActiveCategory,
    navRef,
    menuRef,
    scrollToCategory,
    requestUpdate,
  };
}
