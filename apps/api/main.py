from fastapi import Depends, FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.repositories.menu_repository import SqlAlchemyMenuRepository
from app.schemas.menu import RestaurantMenu
from app.services.assistant_service import AssistantService

app = FastAPI(
    title="Cafe Voice Assistant API",
    version="0.1.0",
)

assistant_service = AssistantService()


class TextQuestionRequest(BaseModel):
    question: str


class QuestionResponse(BaseModel):
    transcript: str | None = None
    answer: str


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get(
    "/api/v1/restaurants/{restaurant_slug}/menu",
    response_model=RestaurantMenu,
)
async def get_restaurant_menu(
    restaurant_slug: str,
    db: AsyncSession = Depends(get_db),
) -> RestaurantMenu:
    repo = SqlAlchemyMenuRepository(db)
    menu = await repo.get_by_restaurant_slug(restaurant_slug)

    if menu is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    return menu


@app.post(
    "/api/v1/restaurants/{restaurant_slug}/ask-text",
    response_model=QuestionResponse,
)
async def ask_text_question(
    restaurant_slug: str,
    body: TextQuestionRequest,
    db: AsyncSession = Depends(get_db),
) -> QuestionResponse:
    repo = SqlAlchemyMenuRepository(db)
    menu = await repo.get_by_restaurant_slug(restaurant_slug)

    if menu is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    answer = await assistant_service.answer_text_question(menu, body.question)
    return QuestionResponse(answer=answer)


@app.post(
    "/api/v1/restaurants/{restaurant_slug}/ask-voice",
    response_model=QuestionResponse,
)
async def ask_voice_question(
    restaurant_slug: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> QuestionResponse:
    repo = SqlAlchemyMenuRepository(db)
    menu = await repo.get_by_restaurant_slug(restaurant_slug)

    if menu is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    audio_bytes = await file.read()
    transcript, answer = await assistant_service.answer_voice_question(
        menu, audio_bytes, file.filename or "audio.webm"
    )
    return QuestionResponse(transcript=transcript, answer=answer)