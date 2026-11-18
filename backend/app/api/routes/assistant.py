from typing import List, Optional
from fastapi import APIRouter, Depends, status

from backend.app.core.auth import get_current_user, UserTokenPayload
from backend.app.schemas.assistant import (
    ChatMessageRequest,
    ChatMessageResponse,
    ConversationCreateRequest,
    ConversationResponse,
)
from backend.app.services.rag_service import RAGAssistantService

router = APIRouter(prefix="/assistant", tags=["AI Medical Records Assistant"])


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create AI Assistant Conversation",
    description="Starts a new private conversational session scoped to the authenticated patient's records.",
)
def create_conversation(
    payload: ConversationCreateRequest,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> ConversationResponse:
    """Creates a chat conversation."""
    return RAGAssistantService.create_conversation(current_user.user_id, payload.title)


@router.get(
    "/conversations",
    response_model=List[ConversationResponse],
    status_code=status.HTTP_200_OK,
    summary="List Conversations",
    description="Returns all conversation sessions owned by the authenticated patient.",
)
def list_conversations(
    current_user: UserTokenPayload = Depends(get_current_user),
) -> List[ConversationResponse]:
    """Lists conversations."""
    return RAGAssistantService.list_conversations(current_user.user_id)


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Conversation Messages",
    description="Retrieves a conversation and all its messages after verifying ownership.",
)
def get_conversation(
    conversation_id: str,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> ConversationResponse:
    """Retrieves conversation with history."""
    return RAGAssistantService.get_conversation(conversation_id, current_user.user_id)


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Conversation",
    description="Permanently deletes a conversation session and all its messages.",
)
def delete_conversation(
    conversation_id: str,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> dict:
    """Deletes conversation."""
    RAGAssistantService.delete_conversation(conversation_id, current_user.user_id)
    return {"status": "success", "message": "Conversation deleted."}


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask Question with Document Citations",
    description=(
        "Executes a scoped RAG query across the authenticated patient's medical records. "
        "Returns answers with source document citations, zero hallucinations, and safety guardrails."
    ),
)
async def ask_question(
    conversation_id: str,
    payload: ChatMessageRequest,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> ChatMessageResponse:
    """Queries medical records via RAG."""
    return await RAGAssistantService.ask_question(
        conv_id=conversation_id,
        user_id=current_user.user_id,
        user_query=payload.content,
    )
