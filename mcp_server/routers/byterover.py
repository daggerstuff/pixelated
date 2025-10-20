"""
Byterover Tools Router

Provides knowledge storage and retrieval functionality for the MCP server.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import structlog
from pathlib import Path
import json
import datetime

from ..middleware.auth import get_current_user
from ..models.agent import User

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/byterover", tags=["byterover"])


class StoreKnowledgeRequest(BaseModel):
    """Request model for storing knowledge."""
    content: str = Field(
        description="The knowledge content to store",
        min_length=1,
        max_length=10000
    )


class StoreKnowledgeResponse(BaseModel):
    """Response model for storing knowledge."""
    status: str
    message: str
    filename: str | None = None


class RetrieveKnowledgeRequest(BaseModel):
    """Request model for retrieving knowledge."""
    query: str = Field(
        description="The query to search for relevant knowledge",
        min_length=1,
        max_length=500
    )


class KnowledgeEntry(BaseModel):
    """Model for a knowledge entry."""
    timestamp: str
    content: str
    file: str
    relevance_score: float = 0.0


class RetrieveKnowledgeResponse(BaseModel):
    """Response model for retrieving knowledge."""
    results: list[KnowledgeEntry]
    total_found: int
    message: str


class ByteroverKnowledgeManager:
    """Manages knowledge storage and retrieval."""
    
    def __init__(self, knowledge_dir: Path | None = None):
        """Initialize the knowledge manager."""
        self.knowledge_dir = knowledge_dir or Path.home() / ".byterover" / "knowledge"
        self.knowledge_dir.mkdir(parents=True, exist_ok=True)
        logger.info("Byterover knowledge manager initialized", knowledge_dir=str(self.knowledge_dir))
    
    async def store_knowledge(self, content: str) -> str:
        """Store knowledge in the knowledge base."""
        try:
            # Create a knowledge entry with timestamp
            timestamp = datetime.datetime.now().isoformat()
            
            # Generate a unique filename
            filename = f"knowledge_{timestamp.replace(':', '-')}.json"
            filepath = self.knowledge_dir / filename
            
            # Store the knowledge
            knowledge_data = {
                "timestamp": timestamp,
                "content": content,
                "type": "general_knowledge"
            }
            
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(knowledge_data, f, indent=2)
            
            logger.info("Knowledge stored successfully", filename=filename, content_length=len(content))
            return f"✅ Knowledge stored successfully in {filename}"
            
        except Exception as e:
            logger.error("Error storing knowledge", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"❌ Error storing knowledge: {e!s}"
            )
    
    async def retrieve_knowledge(self, query: str) -> tuple[list[dict], int, str]:
        """Retrieve relevant knowledge from the knowledge base."""
        try:
            relevant_knowledge = []
            
            # Search through all knowledge files
            for knowledge_file in self.knowledge_dir.glob("knowledge_*.json"):
                try:
                    with open(knowledge_file, encoding="utf-8") as f:
                        knowledge_data = json.load(f)
                    
                    # Simple relevance check - look for query terms in content
                    content = knowledge_data.get("content", "").lower()
                    query_terms = query.lower().split()
                    
                    # Calculate relevance score
                    relevance_score = 0
                    for term in query_terms:
                        if term in content:
                            relevance_score += 1
                    
                    # Check if any query term is in the content
                    if relevance_score > 0:
                        relevant_knowledge.append({
                            "timestamp": knowledge_data.get("timestamp", "unknown"),
                            "content": knowledge_data.get("content", ""),
                            "file": knowledge_file.name,
                            "relevance_score": relevance_score / len(query_terms)
                        })
                        
                except (json.JSONDecodeError, KeyError):
                    # Skip invalid knowledge files
                    continue
            
            # Sort by relevance score
            relevant_knowledge.sort(key=lambda x: x["relevance_score"], reverse=True)
            
            total_found = len(relevant_knowledge)
            
            if relevant_knowledge:
                logger.info("Knowledge retrieved successfully", query=query, total_found=total_found)
                return relevant_knowledge[:5], total_found, "✅ Knowledge retrieved successfully"
            else:
                logger.info("No relevant knowledge found", query=query)
                return [], 0, "🔍 No relevant knowledge found for your query."
                
        except Exception as e:
            logger.error("Error retrieving knowledge", error=str(e), query=query)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"❌ Error retrieving knowledge: {e!s}"
            )


# Initialize knowledge manager
knowledge_manager = ByteroverKnowledgeManager()


@router.post("/store-knowledge", response_model=StoreKnowledgeResponse)
async def store_knowledge(
    request: StoreKnowledgeRequest,
    current_user: User = Depends(get_current_user)
) -> StoreKnowledgeResponse:
    """
    Store knowledge about patterns, APIs, architectural decisions, error solutions, 
    debugging techniques, reusable code patterns, or utility functions.
    """
    try:
        result = await knowledge_manager.store_knowledge(request.content)
        
        # Extract filename from result
        filename = None
        if "successfully in" in result:
            filename = result.split("successfully in ")[1]
        
        return StoreKnowledgeResponse(
            status="success",
            message=result,
            filename=filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Unexpected error storing knowledge", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error while storing knowledge"
        )


@router.post("/retrieve-knowledge", response_model=RetrieveKnowledgeResponse)
async def retrieve_knowledge(
    request: RetrieveKnowledgeRequest,
    current_user: User = Depends(get_current_user)
) -> RetrieveKnowledgeResponse:
    """
    Retrieve relevant knowledge for context, patterns, solutions, or architectural decisions.
    """
    try:
        results, total_found, message = await knowledge_manager.retrieve_knowledge(request.query)
        
        return RetrieveKnowledgeResponse(
            results=results,
            total_found=total_found,
            message=message
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Unexpected error retrieving knowledge", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error while retrieving knowledge"
        )


@router.get("/health")
async def health_check() -> dict:
    """Health check endpoint for byterover tools."""
    return {
        "status": "healthy",
        "service": "byterover-tools",
        "knowledge_dir": str(knowledge_manager.knowledge_dir),
        "knowledge_files": len(list(knowledge_manager.knowledge_dir.glob("knowledge_*.json")))
    }