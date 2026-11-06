import { useState } from 'react';
import './App.css';

const welcomeMessage =
  'سلام، به کافهٔ آزمایشی خوش آمدید. دربارهٔ غذاها هر سؤالی دارید بپرسید.';

function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState(
    'برای شنیدن خوشامدگویی، دکمه را لمس کنید.',
  );

  function startConversation() {
    if (
      !('speechSynthesis' in window) ||
      !('SpeechSynthesisUtterance' in window)
    ) {
      setStatus('مرورگر شما پخش گفتار را پشتیبانی نمی‌کند.');
      return;
    }

    const speech = window.speechSynthesis;
    const utterance = new window.SpeechSynthesisUtterance(welcomeMessage);

    utterance.lang = 'fa-IR';
    utterance.rate = 0.9;

    const persianVoice = speech
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith('fa'));

    if (persianVoice) {
      utterance.voice = persianVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setStatus('در حال پخش خوشامدگویی…');
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setStatus('خوشامدگویی تمام شد. پرسش صوتی را بعداً اضافه می‌کنیم.');
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setStatus('پخش صدا انجام نشد. تنظیمات صدای دستگاه را بررسی کنید.');
    };

    setHasStarted(true);
    setIsSpeaking(true);
    setStatus('در حال پخش خوشامدگویی…');

    speech.cancel();
    speech.speak(utterance);
  }

  return (
    <main className="page" dir="rtl">
      <section className="card" aria-labelledby="restaurant-name">
        <header className="card-header">
          <div className="brand-mark" aria-hidden="true">
            ک
          </div>

          <div className="restaurant-info">
            <p>دستیار صوتی منو</p>
            <h1 id="restaurant-name">کافهٔ آزمایشی</h1>
          </div>

          <span className="demo-badge">نسخهٔ آزمایشی</span>
        </header>

        <div className="hero">
          <div className="sound-icon" aria-hidden="true">
            ♫
          </div>

          <p className="welcome-kicker">به جمع ما خوش آمدید</p>
          <h2>دربارهٔ منو چه دوست دارید بدانید؟</h2>

          <p className="description">
            می‌توانید دربارهٔ غذاها، مواد تشکیل‌دهنده، قیمت یا میزان تندی سؤال
            کنید.
          </p>

          <button
            className="start-button"
            type="button"
            onClick={startConversation}
            disabled={isSpeaking}
          >
            <span className="play-icon" aria-hidden="true">
              ▶
            </span>
            {isSpeaking
              ? 'در حال پخش…'
              : hasStarted
                ? 'پخش دوبارهٔ خوشامدگویی'
                : 'شروع مکالمه'}
          </button>

          <p className="status-message" role="status" aria-live="polite">
            {status}
          </p>
        </div>

        <div className="examples">
          <p className="example-title">مثلاً می‌توانید بپرسید:</p>
          <div className="question-list">
            <span className="question-chip">این غذا تنده؟</span>
            <span className="question-chip">مواد تشکیل‌دهنده‌اش چیه؟</span>
            <span className="question-chip">قیمتش چقدره؟</span>
          </div>
        </div>

        <footer className="card-footer">
          بدون نصب اپلیکیشن · در این نمونه فقط خوشامدگویی صوتی فعال است
        </footer>
      </section>
    </main>
  );
}

export default App;