"use client";

import { useCallback, useRef, useState } from "react";

import type { MenuItem } from "@/lib/menu-types";

export type AssistantTurn = {
  id: string;
  question: string;
  answer: string;
  recommendations: MenuItem[];
};

const MAX_CONVERSATION_TURNS = 6;

const RATE_LIMIT_MESSAGE =
  "تعداد پرسش‌های شما بیش از حد مجاز شده است؛ لطفاً کمی صبر کنید و دوباره بپرسید.";
const UNAVAILABLE_MESSAGE =
  "دستیار هوشمند موقتاً در دسترس نیست؛ چند لحظه بعد دوباره تلاش کنید.";
const GENERIC_ERROR_MESSAGE = "ارتباط با دستیار برقرار نشد؛ دوباره تلاش کنید.";

/** پیام فارسی سرور (اگر بفرستد) را می‌خواند. */
async function readServerMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string" && body.detail.trim()) {
      return body.detail.trim();
    }
  } catch {
    // بدنهٔ پاسخ JSON نبود؛ پیام پیش‌فرض استفاده می‌شود.
  }
  return null;
}

export function useMenuAssistant(restaurantSlug: string) {
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const turnsRef = useRef<AssistantTurn[]>([]);
  const isAskingRef = useRef(false);
  const turnCounterRef = useRef(0);

  const ask = useCallback(
    async (rawQuestion: string): Promise<boolean> => {
      const question = rawQuestion.trim();
      if (!question || isAskingRef.current || !restaurantSlug) return false;

      isAskingRef.current = true;
      setPendingQuestion(question);
      setIsAsking(true);
      setError(null);

      try {
        const history = turnsRef.current
          .slice(-MAX_CONVERSATION_TURNS)
          .map((turn) => ({ question: turn.question, answer: turn.answer }));

        const response = await fetch(
          `/api/v1/restaurants/${restaurantSlug}/ask-text`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question, history }),
          },
        );

        if (!response.ok) {
          const serverMessage = await readServerMessage(response);
          if (serverMessage) throw new Error(serverMessage);
          if (response.status === 429) throw new Error(RATE_LIMIT_MESSAGE);
          if (response.status >= 500) throw new Error(UNAVAILABLE_MESSAGE);
          throw new Error(GENERIC_ERROR_MESSAGE);
        }

        const data = (await response.json()) as {
          answer?: string;
          recommended_items?: MenuItem[];
        };
        const answer = (data.answer ?? "").trim();
        if (!answer) {
          throw new Error("پاسخ خالی از دستیار دریافت شد.");
        }

        turnCounterRef.current += 1;
        const turn: AssistantTurn = {
          id: `turn-${Date.now()}-${turnCounterRef.current}`,
          question,
          answer,
          recommendations: Array.isArray(data.recommended_items)
            ? data.recommended_items
            : [],
        };
        turnsRef.current = [...turnsRef.current, turn];
        setTurns(turnsRef.current);
        return true;
      } catch (requestError: unknown) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "خطا در دریافت پاسخ از دستیار",
        );
        return false;
      } finally {
        isAskingRef.current = false;
        setPendingQuestion(null);
        setIsAsking(false);
      }
    },
    [restaurantSlug],
  );

  const reset = useCallback(() => {
    turnsRef.current = [];
    setTurns([]);
    setError(null);
    setPendingQuestion(null);
  }, []);

  return {
    turns,
    pendingQuestion,
    isAsking,
    error,
    ask,
    reset,
  };
}

export type MenuAssistantState = ReturnType<typeof useMenuAssistant>;
