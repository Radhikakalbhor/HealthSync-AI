from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CitationItem(BaseModel):
    document_id: str
    document_filename: str
    document_date: Optional[str] = None
    document_type: Optional[str] = None
    snippet: str
    relevance_score: Optional[float] = None


class ChatMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000, examples=["What medicines were prescribed to me recently?"])


class ChatMessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str  # 'user', 'assistant', 'system'
    content: str
    citations: List[CitationItem] = []
    created_at: str
    disclaimer: str


class ConversationCreateRequest(BaseModel):
    title: Optional[str] = Field(None, max_length=150, examples=["Prescription & Blood Test Query"])


class ConversationResponse(BaseModel):
    id: str
    user_id: str
    title: str
    created_at: str
    updated_at: str
    messages: Optional[List[ChatMessageResponse]] = None
