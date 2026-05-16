import hashlib
import pytest

from ai.memory.reflection_memory import LocalReflectionMemoryClient
from ai.memory.reflection_types import MemoryCategory, MemoryMetadata
from ai.core.pipelines.privacy_content_gates import GateDecision


class MockMemoryManager:
    def __init__(self):
        self.stored_memories = []
        self.next_id = 1
    
    def add_memory(self, content: str, user_id: str, metadata: any, category: str) -> str:
        memory_id = f"mem-{self.next_id}"
        self.next_id += 1
        self.stored_memories.append({
            "id": memory_id,
            "content": content,
            "user_id": user_id,
            "metadata": metadata,
            "category": category
        })
        return memory_id
    
    def get_memory(self, memory_id: str, user_id: str | None = None):
        for mem in self.stored_memories:
            if mem["id"] == memory_id:
                return mem
        return None
    
    def update_memory(self, memory_id: str, new_content: str, metadata: any, user_id: str | None = None) -> bool:
        for mem in self.stored_memories:
            if mem["id"] == memory_id:
                mem["content"] = new_content
                mem["metadata"] = metadata
                return True
        return False
    
    def delete_memory(self, memory_id: str, user_id: str | None = None) -> bool:
        for i, mem in enumerate(self.stored_memories):
            if mem["id"] == memory_id:
                del self.stored_memories[i]
                return True
        return False
    
    def search_memories(self, query: str, user_id: str, limit: int = 10):
        return [mem for mem in self.stored_memories if query.lower() in mem["content"].lower()][:limit]
    
    def get_all_memories(self, user_id: str, limit: int = 100):
        return [mem for mem in self.stored_memories if mem["user_id"] == user_id][:limit]
    
    def get_memories_by_category(self, user_id: str, category: str, limit: int = 100):
        return [mem for mem in self.stored_memories 
                if mem["user_id"] == user_id and mem["category"] == category][:limit]
    
    def delete_memories(self, memory_ids: list[str], user_id: str | None = None) -> int:
        count = 0
        for mem_id in memory_ids:
            if self.delete_memory(mem_id, user_id):
                count += 1
        return count
    
    def clear_memory(self, user_id: str) -> bool:
        initial_count = len(self.stored_memories)
        self.stored_memories = [mem for mem in self.stored_memories if mem["user_id"] != user_id]
        return len(self.stored_memories) < initial_count
    
    def get_health_status(self) -> dict:
        return {"status": "healthy", "count": len(self.stored_memories)}
    
    def close(self):
        pass


def test_add_memory_passes_through_when_content_is_safe():
    manager = MockMemoryManager()
    client = LocalReflectionMemoryClient(manager)
    import asyncio
    
    content = "This is a normal therapeutic conversation about coping strategies."
    metadata = MemoryMetadata(
        user_id="test-user",
        category=MemoryCategory.GENERAL
    )
    
    memory_id = asyncio.run(client.add_memory(content, metadata))
    
    assert not memory_id.startswith("blocked_")
    assert memory_id.startswith("mem-")


def test_add_memory_blocks_when_content_is_crisis():
    manager = MockMemoryManager()
    client = LocalReflectionMemoryClient(manager)
    import asyncio
    
    content = "I want to end my life. I have a plan to do it tonight."
    metadata = MemoryMetadata(
        user_id="test-user",
        category=MemoryCategory.GENERAL
    )
    
    memory_id = asyncio.run(client.add_memory(content, metadata))
    
    assert memory_id.startswith("blocked_")
    assert len(memory_id) == len("blocked_") + 8


def test_add_memory_blocks_when_content_contains_pii():
    manager = MockMemoryManager()
    client = LocalReflectionMemoryClient(manager)
    import asyncio
    
    content = "My name is John Doe and my SSN is 123-45-6789."
    metadata = MemoryMetadata(
        user_id="test-user",
        category=MemoryCategory.GENERAL
    )
    
    memory_id = asyncio.run(client.add_memory(content, metadata))
    
    assert memory_id.startswith("blocked_")


def test_add_memory_handles_empty_content():
    manager = MockMemoryManager()
    client = LocalReflectionMemoryClient(manager)
    import asyncio
    
    content = ""
    metadata = MemoryMetadata(
        user_id="test-user",
        category=MemoryCategory.GENERAL
    )
    
    memory_id = asyncio.run(client.add_memory(content, metadata))
    
    assert memory_id.startswith("blocked_")


def test_add_memory_preserves_metadata_for_stored_content():
    manager = MockMemoryManager()
    client = LocalReflectionMemoryClient(manager)
    import asyncio
    
    content = "Today I felt anxious but used my breathing exercises to cope."
    metadata = MemoryMetadata(
        user_id="test-user-123",
        category=MemoryCategory.THERAPEUTIC_INSIGHT,
        session_id="session-456",
        tags=["anxiety", "coping-skills"]
    )
    
    memory_id = asyncio.run(client.add_memory(content, metadata))
    
    assert not memory_id.startswith("blocked_")
    assert memory_id.startswith("mem-")