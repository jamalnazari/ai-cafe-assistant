import json

from app.schemas.chat import ConversationTurn, MAX_CONVERSATION_TURNS
from app.schemas.menu import RestaurantMenu
from app.providers.stt import get_stt_provider
from app.providers.llm import get_llm_provider


class AssistantService:
    def __init__(self) -> None:
        self.stt_provider = get_stt_provider()
        self.llm_provider = get_llm_provider()

    @staticmethod
    def _menu_payload(menu: RestaurantMenu) -> dict:
        """ساخت نمای ساخت‌یافته و بدون ابهام از منو برای LLM."""
        items = []
        for item in menu.items:
            price_toman = (item.price.amount // 10) if item.price else 0
            items.append(
                {
                    "id": item.id,
                    "name": item.name,
                    "category": item.category,
                    "price_toman": price_toman,
                    "description": item.description,
                    "ingredients": item.ingredients or [],
                    # null یعنی بررسی نشده؛ [] یعنی بررسی شده و آلرژنی ثبت نشده است.
                    "allergens": item.allergens,
                    "aliases": item.aliases or [],
                    "is_spicy": bool(item.is_spicy),
                    "serving_temperature": item.serving_temperature,
                    "is_available": item.is_available,
                }
            )

        return {
            "restaurant": {
                "name": menu.restaurant_name,
                "slug": menu.restaurant_slug,
                # توضیحات کلی مجموعه که صاحب کافه وارد کرده است؛ null یعنی ثبت نشده.
                "about": menu.restaurant_about,
                "currency": "تومان",
                "serving_temperature_values": {
                    "hot": "گرم",
                    "cold": "سرد",
                    "room_temperature": "دمای محیط",
                },
            },
            "categories": menu.categories,
            "items": items,
        }

    def _build_system_prompt(self, menu: RestaurantMenu) -> str:
        """ساخت پرامپت دقیق همراه با اطلاعات واقعی منو برای جلوگیری از توهم AI"""
        menu_json = json.dumps(
            self._menu_payload(menu),
            ensure_ascii=False,
            indent=2,
        )

        return (
            f"تو دستیار متنی منوی کافه «{menu.restaurant_name}» هستی.\n"
            "وظیفه‌ات پاسخ به پرسش‌های مشتری دربارهٔ منو، به زبان فارسی، "
            "محترمانه، دقیق و کوتاه است.\n\n"
            "قوانین بسیار مهم:\n"
            "۱. فقط و فقط از دادهٔ ساخت‌یافتهٔ همین پرامپت (بخش MENU و فیلد "
            "about در بخش restaurant) پاسخ بده؛ هیچ آیتم، قیمت، ترکیب یا "
            "ویژگی‌ای از خودت نساز و حدس نزن.\n"
            "۲. نام هر آیتم را دقیقاً همان‌طور که در فیلد name آمده بنویس؛ "
            "از نام‌های جایگزین (aliases) فقط برای فهم سؤال استفاده کن، نه "
            "برای نوشتن پاسخ.\n"
            "۳. قیمت‌ها در فیلد price_toman به تومان هستند؛ همان عدد را به "
            "تومان بیان کن و آن را به ریال تبدیل نکن.\n"
            "۴. اگر آیتمی در MENU نیست یا اطلاعاتی مثل ترکیبات/آلرژن ثبت "
            "نشده، حدس نزن؛ بگو اطلاعات ثبت نشده و مشتری از پرسنل کافه "
            "بپرسد. مقدار null در allergens یعنی «ثبت نشده» و [] یعنی "
            "«بررسی شده و آلرژنی ثبت نشده است».\n"
            "۵. اگر آیتمی is_available=false است، صریحاً بگو فعلاً موجود "
            "نیست و آن را پیشنهاد نده.\n"
            "۶. وقتی پیشنهاد می‌دهی، حداکثر سه آیتم موجود از MENU انتخاب کن "
            "و نام دقیق آن‌ها را بنویس تا مشتری بتواند در منو پیدایشان کند.\n"
            "۷. پاسخ را در قالب متن ساده و بدون Markdown بنویس؛ پاسخ‌های "
            "کوتاه و قابل خواندن روی موبایل مناسب‌ترند.\n"
            "۸. تاریخچه گفتگو فقط برای فهم ارجاع‌ها و سؤال‌های پیگیری است؛ "
            "اطلاعات MENU همیشه بر پاسخ‌های قبلی مقدم است و نباید از روی "
            "تاریخچه اطلاعات تازه‌ای ساخت.\n"
            "۹. اگر پرسش مشتری عمومی و دربارهٔ خود مجموعه است (ساعت کاری، "
            "آدرس، فضای کافه، پارکینگ، رزرو، مناسبت‌ها، اینترنت و مانند "
            "آن)، پاسخ را فقط از رشتهٔ about در بخش restaurant بردار و "
            "کوتاه و طبیعی بازگو کن. اگر about خالی (null) بود یا پاسخ در "
            "آن نبود، بگو این اطلاعات ثبت نشده و مشتری از پرسنل کافه "
            "بپرسد؛ از دانش عمومی خودت استفاده نکن.\n\n"
            "دادهٔ منوی فعلی کافه (JSON):\n"
            f"{menu_json}"
        )

    async def answer_text_question(
        self,
        menu: RestaurantMenu,
        question: str,
        history: list[ConversationTurn] | None = None,
    ) -> str:
        system_prompt = self._build_system_prompt(menu)
        recent_turns = (history or [])[-MAX_CONVERSATION_TURNS:]
        previous_turns = [
            (turn.question, turn.answer) for turn in recent_turns
        ]
        return await self.llm_provider.generate_response(
            system_prompt, question, previous_turns
        )

    async def answer_voice_question(
        self, menu: RestaurantMenu, audio_bytes: bytes, filename: str
    ) -> tuple[str, str]:
        # ۱. تبدیل صدا به متن
        transcript = await self.stt_provider.transcribe(audio_bytes, filename)
        # ۲. پاسخ به متن استخراج شده
        answer = await self.answer_text_question(menu, transcript)
        return transcript, answer
