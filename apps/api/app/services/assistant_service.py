from app.schemas.chat import ConversationTurn, MAX_CONVERSATION_TURNS
from app.schemas.menu import RestaurantMenu
from app.providers.stt import get_stt_provider
from app.providers.llm import get_llm_provider


class AssistantService:
    def __init__(self) -> None:
        self.stt_provider = get_stt_provider()
        self.llm_provider = get_llm_provider()

    def _build_system_prompt(self, menu: RestaurantMenu) -> str:
        """ساخت پرامپت دقیق همراه با اطلاعات واقعی منو برای جلوگیری از توهم AI"""
        items_text = []
        for item in menu.items:
            status = "موجود" if item.is_available else "ناموجود"
            price_toman = (item.price.amount // 10) if item.price else 0
            
            ingredients_str = ", ".join(item.ingredients) if item.ingredients else "مشخص نشده"
            allergens_str = ", ".join(item.allergens) if item.allergens is not None else "ثبت نشده"
            spicy_str = "تند" if item.is_spicy else "غیر تند"

            item_line = (
                f"- نام: {item.name} | دسته‌بندی: {item.category} | قیمت: {price_toman:,} تومان | وضعیت: {status}\n"
                f"  توضیحات: {item.description}\n"
                f"  ترکیبات: {ingredients_str} | حساسیت‌زاها: {allergens_str} | میزان تندی: {spicy_str}"
            )
            items_text.append(item_line)

        menu_context = "\n\n".join(items_text)

        return (
            f"شما دستیار متنی کافه «{menu.restaurant_name}» هستید.\n"
            "وظیفه شما پاسخ به سوالات مشتریان درباره منو به زبان فارسی، بسیار محترمانه و کوتاه است.\n\n"
            "قوانین بسیار مهم:\n"
            "۱. فقط و فقط بر اساس اطلاعات منوی زیر پاسخ دهید.\n"
            "۲. اگر آیتمی در منو وجود ندارد یا اطلاعاتی مثل حساسیت/ترکیبات ثبت نشده، به هیچ وجه حدس نزنید و بگوئید اطلاعات ثبت نشده و از پرسنل بپرسند.\n"
            "۳. قیمت‌ها را همیشه به تومان بگوئید.\n"
            "۴. تاریخچه گفتگو فقط برای فهم ارجاع‌ها و سؤال‌های پیگیری است؛ "
            "اطلاعات منو همیشه بر پاسخ‌های قبلی مقدم است و نباید از روی تاریخچه اطلاعات تازه‌ای ساخت.\n\n"
            f"اطلاعات منوی فعلی کافه:\n{menu_context}"
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
            (turn.question, turn.answer)
            for turn in recent_turns
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