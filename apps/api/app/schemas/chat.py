from pydantic import BaseModel, Field, field_validator


MAX_CONVERSATION_TURNS = 6


class ConversationTurn(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    answer: str = Field(min_length=1, max_length=20000)

    @field_validator("question", "answer")
    @classmethod
    def validate_text(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("متن گفتگو نمی‌تواند خالی باشد.")
        return text


class TextQuestionRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    history: list[ConversationTurn] = Field(
        default_factory=list,
        max_length=MAX_CONVERSATION_TURNS,
    )

    @field_validator("question")
    @classmethod
    def validate_question(cls, value: str) -> str:
        question = value.strip()
        if not question:
            raise ValueError("سؤال نمی‌تواند خالی باشد.")
        return question
