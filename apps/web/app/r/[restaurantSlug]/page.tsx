"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Send, Volume2, Sparkles, AlertCircle } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  description: string;
  ingredients?: string[] | null;
  allergens?: string[] | null;
  is_spicy?: boolean | null;
  price?: {
    amount: number;
    currency: string;
  } | null;
  is_available: boolean;
}

interface RestaurantMenu {
  restaurant_slug: string;
  restaurant_name: string;
  items: MenuItem[];
}

interface PageProps {
  params: Promise<{ restaurantSlug: string }>;
}

export default function GuestMenuPage({ params }: PageProps) {
  const [slug, setSlug] = useState<string>("");
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // حالت‌های پرسش و پاسخ
  const [textQuestion, setTextQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);

  // حالت‌های ضبط صدا
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    params.then((resolvedParams) => {
      setSlug(resolvedParams.restaurantSlug);
      fetchMenu(resolvedParams.restaurantSlug);
    });
  }, [params]);

  const fetchMenu = async (restaurantSlug: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/restaurants/${restaurantSlug}/menu`);
      if (!res.ok) {
        throw new Error("کافه مورد نظر یافت نشد.");
      }
      const data: RestaurantMenu = await res.json();
      setMenu(data);
    } catch (err: any) {
      setError(err.message || "خطا در دریافت اطلاعات منو");
    } finally {
      setLoading(false);
    }
  };

  // ارسال سؤال متنی
  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textQuestion.trim() || isAsking) return;

    try {
      setIsAsking(true);
      setTranscript(null);
      setError(null);

      const res = await fetch(`/api/v1/restaurants/${slug}/ask-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: textQuestion }),
      });

      if (!res.ok) throw new Error("خطا در دریافت پاسخ از دستیار");

      const data = await res.json();
      setAnswer(data.answer);
      setTextQuestion("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAsking(false);
    }
  };

  // شروع ضبط صدا
  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await sendVoiceQuestion(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError("دسترسی به میکروفون داده نشد یا مرورگر پشتیبانی نمی‌کند.");
    }
  };

  // توقف ضبط صدا
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // ارسال فایل صوتی به FastAPI
  const sendVoiceQuestion = async (audioBlob: Blob) => {
    try {
      setIsAsking(true);
      setAnswer(null);

      const formData = new FormData();
      formData.append("file", audioBlob, "voice.webm");

      const res = await fetch(`/api/v1/restaurants/${slug}/ask-voice`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("خطا در پردازش صدا توسط سرور");

      const data = await res.json();
      setTranscript(data.transcript);
      setAnswer(data.answer);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAsking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4" dir="rtl">
        <div className="text-amber-800 font-bold text-lg animate-pulse">در حال دریافت منو...</div>
      </div>
    );
  }

  if (error && !menu) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white p-6 rounded-2xl shadow-sm text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800 mb-2">خطا</h2>
          <p className="text-slate-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50/50 pb-20" dir="rtl">
      {/* هدر کافه */}
      <header className="bg-amber-900 text-amber-50 py-6 px-4 shadow-md text-center rounded-b-3xl">
        <span className="text-xs bg-amber-800 px-3 py-1 rounded-full text-amber-200">
          منوی هوشمند
        </span>
        <h1 className="text-2xl font-bold mt-2">{menu?.restaurant_name}</h1>
        <p className="text-xs text-amber-200/80 mt-1">
          سوالات خود را به صورت صوتی یا متنی بپرسید
        </p>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        {/* بخش دستیار هوشمند */}
        <section className="bg-white p-5 rounded-3xl shadow-sm border border-amber-100 space-y-4">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>دستیار صوتی و متنی منو</span>
          </div>

          {/* نمایش متن استخراج‌شده از صدا */}
          {transcript && (
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs text-slate-600">
              <span className="font-bold text-slate-700">سوال شما (صوتی): </span>
              {transcript}
            </div>
          )}

          {/* پاسخ هوش مصنوعی */}
          {answer && (
            <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 text-sm text-amber-950 leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs mb-1">
                <Volume2 className="w-3.5 h-3.5" />
                <span>پاسخ دستیار:</span>
              </div>
              {answer}
            </div>
          )}

          {/* دکمه ضبط صدا و ورودی متن */}
          <div className="flex items-center gap-2">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isAsking}
              className={`p-3.5 rounded-2xl transition-all text-white flex items-center justify-center ${
                isRecording
                  ? "bg-red-500 animate-bounce"
                  : "bg-amber-800 hover:bg-amber-900"
              } disabled:opacity-50`}
              title={isRecording ? "توقف ضبط" : "شروع ضبط صدا"}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <form onSubmit={handleSendText} className="flex-1 flex gap-2">
              <input
                type="text"
                value={textQuestion}
                onChange={(e) => setTextQuestion(e.target.value)}
                placeholder={isRecording ? "در حال ضبط صدا..." : "پرسش درباره منو..."}
                disabled={isRecording || isAsking}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-800/20 text-slate-800"
              />
              <button
                type="submit"
                disabled={!textQuestion.trim() || isAsking || isRecording}
                className="bg-amber-800 hover:bg-amber-900 text-white p-3 rounded-2xl disabled:opacity-40 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          {isAsking && (
            <p className="text-center text-xs text-amber-700 animate-pulse">
              در حال پردازش پاسخ توسط دستیار...
            </p>
          )}

          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
        </section>

        {/* لیست غذاهای منو */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-700 px-1">لیست آیتم‌های منو</h2>
          {menu?.items.map((item) => (
            <div
              key={item.id}
              className="bg-white p-4 rounded-2xl shadow-sm border border-amber-100/60 flex justify-between items-start"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-800">{item.name}</h3>
                  {item.is_spicy && (
                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md">
                      تند
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>
              </div>
              <div className="text-left shrink-0 mr-2">
                <span className="text-xs font-bold text-amber-900">
                  {item.price ? (item.price.amount / 10).toLocaleString() : 0}
                </span>
                <span className="text-[10px] text-slate-400 block">تومان</span>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}