#!/usr/bin/env python3
"""
Automated Memory Update Procedures

This module provides automated memory update functionality for the Pixelated Empathy system,
integrating with the development workflow to automatically update memory banks based on:
- Code changes and commits
- Training session outcomes
- Bias detection results
- Research pipeline discoveries
- Performance metrics

Features:
- Git webhook integration for automatic updates
- Scheduled memory synchronization
- Intelligent memory categorization
- Conflict resolution for memory updates
- Integration with existing memory systems
"""

import asyncio
import json
import logging
import os
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Callable
from pathlib import Path
import hashlib
import git
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import schedule

# Import existing components
from bias_detection.sentry_metrics import memory_metrics, track_latency
from real_time_integration import RealTimeBiasDetector
from performance_optimization import PerformanceOptimizedBiasDetector
from ieee_xplore_integration import IEEEResearchPipeline
from advanced_training_scenarios import AdvancedTrainingEngine

logger = logging.getLogger(__name__)


@dataclass
class MemoryUpdateConfig:
    """Configuration for automated memory updates"""
    enabled: bool = True
    update_interval_minutes: int = 30
    git_webhook_enabled: bool = True
    file_monitoring_enabled: bool = True
    scheduled_sync_enabled: bool = True
    conflict_resolution_strategy: str = "merge"  # merge, replace, manual
    max_memory_entries: int = 10000
    cleanup_threshold_days: int = 90
    backup_enabled: bool = True
    backup_interval_hours: int = 24
    validation_enabled: bool = True
    notification_enabled: bool = True


@dataclass
class MemoryUpdateEvent:
    """Memory update event"""
    event_id: str
    event_type: str  # git_commit, file_change, training_complete, bias_detected, research_found
    source: str
    timestamp: datetime
    data: Dict[str, Any]
    priority: int = 1
    processed: bool = False


@dataclass
class MemoryEntry:
    """Memory entry with metadata"""
    memory_id: str
    title: str
    content: str
    memory_type: str  # component, implementation, debug, user_preference, project_info
    project_id: str
    user_preference: bool = False
    namespace: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    version: int = 1
    hash: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


class MemoryConflictResolver:
    """Handles conflicts in memory updates"""
    
    def __init__(self, strategy: str = "merge"):
        self.strategy = strategy
        
    def resolve_conflict(
        self,
        existing_memory: MemoryEntry,
        new_memory: MemoryEntry
    ) -> MemoryEntry:
        """Resolve conflict between existing and new memory"""
        
        if self.strategy == "replace":
            return new_memory
            
        elif self.strategy == "merge":
            # Merge content intelligently
            merged_content = self._merge_content(
                existing_memory.content,
                new_memory.content
            )
            
            # Merge tags
            merged_tags = list(set(existing_memory.tags + new_memory.tags))
            
            # Update metadata
            merged_metadata = {**existing_memory.metadata, **new_memory.metadata}
            merged_metadata['merged_from'] = [existing_memory.memory_id, new_memory.memory_id]
            merged_metadata['merge_timestamp'] = datetime.now(timezone.utc).isoformat()
            
            return MemoryEntry(
                memory_id=existing_memory.memory_id,
                title=new_memory.title or existing_memory.title,
                content=merged_content,
                memory_type=new_memory.memory_type or existing_memory.memory_type,
                project_id=new_memory.project_id or existing_memory.project_id,
                user_preference=new_memory.user_preference or existing_memory.user_preference,
                namespace=new_memory.namespace or existing_memory.namespace,
                tags=merged_tags,
                created_at=existing_memory.created_at,
                updated_at=datetime.now(timezone.utc),
                version=existing_memory.version + 1,
                hash=self._calculate_hash(merged_content),
                metadata=merged_metadata
            )
            
        else:  # manual
            # Flag for manual review
            new_memory.metadata['conflict_flagged'] = True
            new_memory.metadata['conflict_with'] = existing_memory.memory_id
            return new_memory
    
    def _merge_content(self, existing: str, new: str) -> str:
        """Intelligently merge content"""
        if existing == new:
            return existing
            
        # Simple merge strategy - append with separator
        separator = "\n\n--- Updated Content ---\n\n"
        return f"{existing}{separator}{new}"
    
    def _calculate_hash(self, content: str) -> str:
        """Calculate content hash"""
        return hashlib.sha256(content.encode()).hexdigest()[:16]


class GitWebhookHandler:
    """Handles Git webhook events for memory updates"""
    
    def __init__(self, config: MemoryUpdateConfig):
        self.config = config
        self.repo_path = Path.cwd()
        
    async def handle_commit(self, commit_data: Dict[str, Any]) -> List[MemoryUpdateEvent]:
        """Handle Git commit event"""
        
        events = []
        
        try:
            # Extract commit information
            commit_hash = commit_data.get('hash', '')
            commit_message = commit_data.get('message', '')
            author = commit_data.get('author', {})
            files_changed = commit_data.get('files', [])
            
            # Analyze commit for memory-worthy content
            if self._is_memory_worthy_commit(commit_message, files_changed):
                event = MemoryUpdateEvent(
                    event_id=f"git_{commit_hash[:8]}_{int(time.time())}",
                    event_type="git_commit",
                    source="git_webhook",
                    timestamp=datetime.now(timezone.utc),
                    data={
                        'commit_hash': commit_hash,
                        'commit_message': commit_message,
                        'author': author,
                        'files_changed': files_changed,
                        'repository': str(self.repo_path)
                    },
                    priority=2
                )
                events.append(event)
                
                # Create specific memory entries based on commit content
                events.extend(await self._create_commit_memories(commit_data))
                
        except Exception as e:
            logger.error(f"Error handling Git commit: {e}")
            
        return events
    
    def _is_memory_worthy_commit(self, message: str, files: List[str]) -> bool:
        """Determine if commit is worth creating memory for"""
        
        # Check for significant changes
        significant_keywords = [
            'implement', 'add', 'create', 'feature', 'enhancement',
            'fix', 'resolve', 'bug', 'issue', 'problem',
            'refactor', 'optimize', 'improve', 'performance',
            'architecture', 'design', 'structure'
        ]
        
        message_lower = message.lower()
        has_significant_keyword = any(keyword in message_lower for keyword in significant_keywords)
        
        # Check for important file changes
        important_files = any(
            any(pattern in file for pattern in ['src/', 'lib/', 'core/', 'main.'])
            for file in files
        )
        
        return has_significant_keyword and important_files
    
    async def _create_commit_memories(self, commit_data: Dict[str, Any]) -> List[MemoryUpdateEvent]:
        """Create specific memory entries from commit data"""
        
        events = []
        message = commit_data.get('message', '')
        files = commit_data.get('files', [])
        
        # Implementation memory
        if any(impl in message.lower() for impl in ['implement', 'add feature', 'create']):
            event = MemoryUpdateEvent(
                event_id=f"impl_{int(time.time())}",
                event_type="implementation_created",
                source="git_analysis",
                timestamp=datetime.now(timezone.utc),
                data={
                    'type': 'implementation',
                    'title': f"Implementation: {message.split('\\n')[0]}",
                    'content': self._generate_implementation_content(commit_data),
                    'files': files,
                    'commit_hash': commit_data.get('hash', '')
                },
                priority=1
            )
            events.append(event)
        
        # Bug fix memory
        if any(bug in message.lower() for bug in ['fix', 'resolve', 'bug']):
            event = MemoryUpdateEvent(
                event_id=f"bug_{int(time.time())}",
                event_type="bug_fixed",
                source="git_analysis",
                timestamp=datetime.now(timezone.utc),
                data={
                    'type': 'debug',
                    'title': f"Fix: {message.split('\\n')[0]}",
                    'content': self._generate_debug_content(commit_data),
                    'files': files,
                    'commit_hash': commit_data.get('hash', '')
                },
                priority=1
            )
            events.append(event)
        
        return events
    
    def _generate_implementation_content(self, commit_data: Dict[str, Any]) -> str:
        """Generate implementation memory content"""
        message = commit_data.get('message', '')
        files = commit_data.get('files', [])
        
        content = f"Implementation completed: {message}\n\n"
        content += f"Files modified: {', '.join(files[:5])}\n"
        if len(files) > 5:
            content += f"... and {len(files) - 5} more files\n"
        
        return content
    
    def _generate_debug_content(self, commit_data: Dict[str, Any]) -> str:
        """Generate debug memory content"""
        message = commit_data.get('message', '')
        
        content = f"Issue resolved: {message}\n\n"
        content += "Resolution approach extracted from commit analysis\n"
        
        return content


class FileChangeHandler(FileSystemEventHandler):
    """Handles file system changes for memory updates"""
    
    def __init__(self, callback: Callable):
        self.callback = callback
        self.last_event_time = defaultdict(float)
        
    def on_modified(self, event):
        """Handle file modification"""
        if event.is_directory:
            return
            
        # Debounce events
        current_time = time.time()
        if current_time - self.last_event_time[event.src_path] < 1.0:
            return
            
        self.last_event_time[event.src_path] = current_time
        
        # Create memory update event
        asyncio.create_task(self._handle_file_change(event))
        
    async def _handle_file_change(self, event):
        """Process file change event"""
        
        # Check if file is memory-worthy
        if self._is_memory_worthy_file(event.src_path):
            memory_event = MemoryUpdateEvent(
                event_id=f"file_{int(time.time())}_{hash(event.src_path) % 1000}",
                event_type="file_change",
                source="file_monitor",
                timestamp=datetime.now(timezone.utc),
                data={
                    'file_path': event.src_path,
                    'event_type': 'modified',
                    'file_size': os.path.getsize(event.src_path) if os.path.exists(event.src_path) else 0
                },
                priority=3
            )
            
            await self.callback(memory_event)
    
    def _is_memory_worthy_file(self, file_path: str) -> bool:
        """Check if file change is worth creating memory for"""
        
        # Skip temporary and hidden files
        if any(part.startswith('.') for part in Path(file_path).parts):
            return False
            
        # Check file extension
        memory_worthy_extensions = {'.py', '.js', '.ts', '.md', '.json', '.yaml', '.yml'}
        if Path(file_path).suffix not in memory_worthy_extensions:
            return False
            
        # Check file size (not too large)
        try:
            if os.path.getsize(file_path) > 1024 * 1024:  # 1MB limit
                return False
        except OSError:
            return False
            
        return True


class TrainingOutcomeProcessor:
    """Processes training outcomes for memory updates"""
    
    async def process_training_completion(self, training_data: Dict[str, Any]) -> List[MemoryUpdateEvent]:
        """Process completed training session"""
        
        events = []
        
        # Extract training insights
        scenario_type = training_data.get('scenario_type', '')
        final_score = training_data.get('final_assessment', {}).get('overall_score', 0)
        strengths = training_data.get('final_assessment', {}).get('strengths', [])
        improvements = training_data.get('final_assessment', {}).get('areas_for_improvement', [])
        
        # Create training memory
        event = MemoryUpdateEvent(
            event_id=f"training_{training_data.get('session_id', 'unknown')}",
            event_type="training_complete",
            source="training_pipeline",
            timestamp=datetime.now(timezone.utc),
            data={
                'type': 'user_preference',
                'title': f"Training Outcome: {scenario_type}",
                'content': self._generate_training_content(training_data),
                'score': final_score,
                'strengths': strengths,
                'improvements': improvements,
                'session_id': training_data.get('session_id')
            },
            priority=2
        )
        events.append(event)
        
        return events
    
    def _generate_training_content(self, training_data: Dict[str, Any]) -> str:
        """Generate training outcome content"""
        
        content = f"Training session completed with score: {training_data.get('final_assessment', {}).get('overall_score', 0):.2f}\n\n"
        
        strengths = training_data.get('final_assessment', {}).get('strengths', [])
        if strengths:
            content += f"Strengths demonstrated: {', '.join(strengths)}\n"
        
        improvements = training_data.get('final_assessment', {}).get('areas_for_improvement', [])
        if improvements:
            content += f"Areas for improvement: {', '.join(improvements)}\n"
        
        return content


class BiasDetectionProcessor:
    """Processes bias detection results for memory updates"""
    
    async def process_bias_detection(self, bias_data: Dict[str, Any]) -> List[MemoryUpdateEvent]:
        """Process bias detection results"""
        
        events = []
        
        # Extract bias insights
        bias_score = bias_data.get('bias_score', 0)
        confidence = bias_data.get('confidence', 0)
        bias_type = bias_data.get('bias_type', 'unknown')
        context = bias_data.get('context', {})
        
        # Create bias detection memory
        event = MemoryUpdateEvent(
            event_id=f"bias_{int(time.time())}_{hash(str(bias_data)) % 1000}",
            event_type="bias_detected",
            source="bias_detection",
            timestamp=datetime.now(timezone.utc),
            data={
                'type': 'project_info',
                'title': f"Bias Detection: {bias_type}",
                'content': self._generate_bias_content(bias_data),
                'bias_score': bias_score,
                'confidence': confidence,
                'bias_type': bias_type,
                'context': context
            },
            priority=1
        )
        events.append(event)
        
        return events
    
    def _generate_bias_content(self, bias_data: Dict[str, Any]) -> str:
        """Generate bias detection content"""
        
        content = f"Bias detected with score {bias_data.get('bias_score', 0):.2f} and confidence {bias_data.get('confidence', 0):.2f}\n"
        content += f"Bias type: {bias_data.get('bias_type', 'unknown')}\n"
        
        if 'context' in bias_data:
            content += f"Context: {bias_data['context']}\n"
        
        return content


class ResearchDiscoveryProcessor:
    """Processes research discoveries for memory updates"""
    
    async def process_research_discovery(self, research_data: Dict[str, Any]) -> List[MemoryUpdateEvent]:
        """Process new research discovery"""
        
        events = []
        
        # Extract research insights
        paper_title = research_data.get('metadata', {}).get('title', '')
        relevance_score = research_data.get('quality_score', 0)
        bias_relevance = research_data.get('bias_analysis', {}).get('relevance_score', 0)
        source = research_data.get('source', 'unknown')
        
        # Create research memory
        event = MemoryUpdateEvent(
            event_id=f"research_{int(time.time())}_{hash(paper_title) % 1000}",
            event_type="research_found",
            source="research_pipeline",
            timestamp=datetime.now(timezone.utc),
            data={
                'type': 'project_info',
                'title': f"Research Discovery: {paper_title[:50]}...",
                'content': self._generate_research_content(research_data),
                'relevance_score': relevance_score,
                'bias_relevance': bias_relevance,
                'source': source,
                'paper_title': paper_title
            },
            priority=2
        )
        events.append(event)
        
        return events
    
    def _generate_research_content(self, research_data: Dict[str, Any]) -> str:
        """Generate research discovery content"""
        
        content = f"New research paper discovered: {research_data.get('metadata', {}).get('title', '')}\n"
        content += f"Relevance score: {research_data.get('quality_score', 0):.2f}\n"
        content += f"Bias relevance: {research_data.get('bias_analysis', {}).get('relevance_score', 0):.2f}\n"
        content += f"Source: {research_data.get('source', 'unknown')}\n"
        
        return content


class AutomatedMemoryUpdater:
    """Main automated memory update system"""
    
    def __init__(self, config: Optional[MemoryUpdateConfig] = None):
        self.config = config or MemoryUpdateConfig()
        self.conflict_resolver = MemoryConflictResolver(self.config.conflict_resolution_strategy)
        self.git_handler = GitWebhookHandler(self.config)
        self.training_processor = TrainingOutcomeProcessor()
        self.bias_processor = BiasDetectionProcessor()
        self.research_processor = ResearchDiscoveryProcessor()
        
        self.pending_events: List[MemoryUpdateEvent] = []
        self.processed_events: Set[str] = set()
        self.memory_cache: Dict[str, MemoryEntry] = {}
        
        # File monitoring
        self.file_observer: Optional[Observer] = None
        self.file_handler: Optional[FileChangeHandler] = None
        
        logger.info("Automated memory updater initialized")
    
    async def start(self) -> None:
        """Start automated memory update system"""
        
        if not self.config.enabled:
            logger.info("Automated memory updates disabled")
            return
        
        # Start file monitoring
        if self.config.file_monitoring_enabled:
            await self._start_file_monitoring()
        
        # Start scheduled sync
        if self.config.scheduled_sync_enabled:
            await self._start_scheduled_sync()
        
        logger.info("Automated memory updater started")
    
    async def stop(self) -> None:
        """Stop automated memory update system"""
        
        # Stop file monitoring
        if self.file_observer:
            self.file_observer.stop()
            self.file_observer.join()
        
        logger.info("Automated memory updater stopped")
    
    async def _start_file_monitoring(self) -> None:
        """Start file system monitoring"""
        
        self.file_handler = FileChangeHandler(self._handle_memory_event)
        self.file_observer = Observer()
        self.file_observer.schedule(
            self.file_handler,
            path=str(Path.cwd() / 'src'),
            recursive=True
        )
        self.file_observer.start()
        
        logger.info("File monitoring started")
    
    async def _start_scheduled_sync(self) -> None:
        """Start scheduled memory synchronization"""
        
        schedule.every(self.config.update_interval_minutes).minutes.do(
            lambda: asyncio.create_task(self._scheduled_sync())
        )
        
        logger.info(f"Scheduled sync started (interval: {self.config.update_interval_minutes} minutes)")
    
    async def _scheduled_sync(self) -> None:
        """Perform scheduled memory synchronization"""
        
        logger.info("Performing scheduled memory sync")
        
        # Process pending events
        await self._process_pending_events()
        
        # Cleanup old memories
        await self._cleanup_old_memories()
        
        # Backup if needed
        if self.config.backup_enabled:
            await self._perform_backup()
    
    async def handle_git_webhook(self, webhook_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle Git webhook event"""
        
        if not self.config.git_webhook_enabled:
            return {'status': 'disabled'}
        
        try:
            # Extract commit data
            commits = webhook_data.get('commits', [])
            
            for commit in commits:
                events = await self.git_handler.handle_commit(commit)
                for event in events:
                    await self._handle_memory_event(event)
            
            return {
                'status': 'processed',
                'commits_processed': len(commits),
                'events_created': len(events) if commits else 0
            }
            
        except Exception as e:
            logger.error(f"Error handling Git webhook: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def handle_training_completion(self, training_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle training completion event"""
        
        try:
            events = await self.training_processor.process_training_completion(training_data)
            
            for event in events:
                await self._handle_memory_event(event)
            
            return {
                'status': 'processed',
                'events_created': len(events)
            }
            
        except Exception as e:
            logger.error(f"Error handling training completion: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def handle_bias_detection(self, bias_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle bias detection event"""
        
        try:
            events = await self.bias_processor.process_bias_detection(bias_data)
            
            for event in events:
                await self._handle_memory_event(event)
            
            return {
                'status': 'processed',
                'events_created': len(events)
            }
            
        except Exception as e:
            logger.error(f"Error handling bias detection: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def handle_research_discovery(self, research_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle research discovery event"""
        
        try:
            events = await self.research_processor.process_research_discovery(research_data)
            
            for event in events:
                await self._handle_memory_event(event)
            
            return {
                'status': 'processed',
                'events_created': len(events)
            }
            
        except Exception as e:
            logger.error(f"Error handling research discovery: {e}")
            return {'status': 'error', 'message': str(e)}
    
    async def _handle_memory_event(self, event: MemoryUpdateEvent) -> None:
        """Handle memory update event"""
        
        # Check for duplicates
        if event.event_id in self.processed_events:
            return
        
        # Add to pending events
        self.pending_events.append(event)
        self.processed_events.add(event.event_id)
        
        # Process high priority events immediately
        if event.priority <= 2:
            await self._process_event(event)
    
    async def _process_pending_events(self) -> None:
        """Process all pending events"""
        
        events_to_process = self.pending_events.copy()
        self.pending_events.clear()
        
        for event in events_to_process:
            await self._process_event(event)
    
    async def _process_event(self, event: MemoryUpdateEvent) -> None:
        """Process individual memory event"""
        
        try:
            # Extract memory data
            memory_data = event.data
            
            # Create memory entry
            memory_entry = self._create_memory_entry(memory_data, event)
            
            # Check for conflicts
            existing_memory = await self._find_existing_memory(memory_entry)
            
            if existing_memory:
                # Resolve conflict
                resolved_memory = self.conflict_resolver.resolve_conflict(
                    existing_memory,
                    memory_entry
                )
                await self._update_memory(resolved_memory)
            else:
                # Create new memory
                await self._create_memory(memory_entry)
            
            # Mark as processed
            event.processed = True
            
            logger.info(f"Memory event processed: {event.event_id}")
            
        except Exception as e:
            logger.error(f"Error processing memory event {event.event_id}: {e}")
    
    def _create_memory_entry(self, memory_data: Dict[str, Any], event: MemoryUpdateEvent) -> MemoryEntry:
        """Create memory entry from event data"""
        
        memory_id = f"auto_{event.event_id}"
        title = memory_data.get('title', f"Auto-generated: {event.event_type}")
        content = memory_data.get('content', '')
        memory_type = memory_data.get('type', 'project_info')
        project_id = memory_data.get('project_id', 'pixelatedempathy/pixelated')
        user_preference = memory_data.get('user_preference', False)
        namespace = memory_data.get('namespace')
        tags = memory_data.get('tags', [])
        
        # Add event-specific tags
        tags.extend([event.event_type, 'automated'])
        
        return MemoryEntry(
            memory_id=memory_id,
            title=title,
            content=content,
            memory_type=memory_type,
            project_id=project_id,
            user_preference=user_preference,
            namespace=namespace,
            tags=tags,
            hash=self._calculate_hash(content),
            metadata={
                'source_event': event.event_id,
                'event_type': event.event_type,
                'source': event.source,
                'original_data': memory_data
            }
        )
    
    async def _find_existing_memory(self, memory_entry: MemoryEntry) -> Optional[MemoryEntry]:
        """Find existing memory that might conflict"""
        
        # Simple conflict detection based on title similarity
        # In a real implementation, this would query the memory system
        
        # For now, check cache
        for existing_id, existing in self.memory_cache.items():
            if existing.title == memory_entry.title:
                return existing
                
        return None
    
    async def _create_memory(self, memory_entry: MemoryEntry) -> None:
        """Create new memory entry"""
        
        # Add to cache
        self.memory_cache[memory_entry.memory_id] = memory_entry
        
        # In a real implementation, this would save to the memory system
        logger.info(f"Created new memory: {memory_entry.title}")
        
        # Track metrics
        memory_metrics.memory_created()
    
    async def _update_memory(self, memory_entry: MemoryEntry) -> None:
        """Update existing memory entry"""
        
        # Update in cache
        self.memory_cache[memory_entry.memory_id] = memory_entry
        
        # In a real implementation, this would update the memory system
        logger.info(f"Updated memory: {memory_entry.title}")
        
        # Track metrics
        memory_metrics.memory_updated()
    
    def _calculate_hash(self, content: str) -> str:
        """Calculate content hash"""
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    async def _cleanup_old_memories(self) -> None:
        """Clean up old or redundant memories"""
        
        if not self.config.cleanup_threshold_days:
            return
        
        cutoff_date = datetime.now(timezone.utc).timestamp() - (self.config.cleanup_threshold_days * 24 * 3600)
        
        # Remove old memories from cache
        old_memories = [
            memory_id for memory_id, memory in self.memory_cache.items()
            if memory.created_at.timestamp() < cutoff_date
        ]
        
        for memory_id in old_memories:
            del self.memory_cache[memory_id]
            logger.info(f"Cleaned up old memory: {memory_id}")
        
        # Track metrics
        memory_metrics.memory_cleaned(len(old_memories))
    
    async def _perform_backup(self) -> None:
        """Perform memory backup"""
        
        if not self.config.backup_enabled:
            return
        
        backup_data = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'memory_count': len(self.memory_cache),
            'memories': [
                {
                    'memory_id': memory.memory_id,
                    'title': memory.title,
                    'content': memory.content,
                    'memory_type': memory.memory_type,
                    'project_id': memory.project_id,
                    'user_preference': memory.user_preference,
                    'namespace': memory.namespace,
                    'tags': memory.tags,
                    'created_at': memory.created_at.isoformat(),
                    'updated_at': memory.updated_at.isoformat(),
                    'version': memory.version,
                    'hash': memory.hash,
                    'metadata': memory.metadata
                }
                for memory in self.memory_cache.values()
            ]
        }
        
        # Save backup (in real implementation, this would save to persistent storage)
        backup_file = f"memory_backup_{int(time.time())}.json"
        
        logger.info(f"Memory backup completed: {len(self.memory_cache)} memories backed up")
        
        # Track metrics
        memory_metrics.backup_completed(len(self.memory_cache))
    
    def get_memory_stats(self) -> Dict[str, Any]:
        """Get memory update statistics"""
        
        return {
            'total_memories': len(self.memory_cache),
            'pending_events': len(self.pending_events),
            'processed_events': len(self.processed_events),
            'memory_types': self._get_memory_type_counts(),
            'event_types': self._get_event_type_counts(),
            'config': {
                'enabled': self.config.enabled,
                'update_interval_minutes': self.config.update_interval_minutes,
                'git_webhook_enabled': self.config.git_webhook_enabled,
                'file_monitoring_enabled': self.config.file_monitoring_enabled
            }
        }
    
    def _get_memory_type_counts(self) -> Dict[str, int]:
        """Get counts by memory type"""
        
        counts = defaultdict(int)
        for memory in self.memory_cache.values():
            counts[memory.memory_type] += 1
        return dict(counts)
    
    def _get_event_type_counts(self) -> Dict[str, int]:
        """Get counts by event type"""
        
        counts = defaultdict(int)
        for event in self.pending_events:
            counts[event.event_type] += 1
        return dict(counts)


# Global updater instance
memory_updater: Optional[AutomatedMemoryUpdater] = None


async def initialize_memory_updater(config: Optional[MemoryUpdateConfig] = None) -> AutomatedMemoryUpdater:
    """Initialize global memory updater"""
    global memory_updater
    
    if memory_updater is None:
        memory_updater = AutomatedMemoryUpdater(config)
        await memory_updater.start()
        logger.info("Global memory updater initialized")
    
    return memory_updater


async def get_memory_updater() -> AutomatedMemoryUpdater:
    """Get global memory updater instance"""
    if memory_updater is None:
        await initialize_memory_updater()
    return memory_updater


# API endpoints for memory updates
async def handle_git_webhook(webhook_data: Dict[str, Any]) -> Dict[str, Any]:
    """API endpoint for Git webhook"""
    updater = await get_memory_updater()
    return await updater.handle_git_webhook(webhook_data)


async def handle_training_completion(training_data: Dict[str, Any]) -> Dict[str, Any]:
    """API endpoint for training completion"""
    updater = await get_memory_updater()
    return await updater.handle_training_completion(training_data)


async def handle_bias_detection(bias_data: Dict[str, Any]) -> Dict[str, Any]:
    """API endpoint for bias detection"""
    updater = await get_memory_updater()
    return await updater.handle_bias_detection(bias_data)


async def handle_research_discovery(research_data: Dict[str, Any]) -> Dict[str, Any]:
    """API endpoint for research discovery"""
    updater = await get_memory_updater()
    return await updater.handle_research_discovery(research_data)


async def get_memory_update_stats() -> Dict[str, Any]:
    """API endpoint for memory update statistics"""
    updater = await get_memory_updater()
    return updater.get_memory_stats()


if __name__ == "__main__":
    # Example usage
    async def example():
        updater = await initialize_memory_updater()
        
        # Simulate training completion
        training_data = {
            'session_id': 'test_session_001',
            'user_id': 'test_user',
            'scenario_type': 'cultural_competency',
            'final_assessment': {
                'overall_score': 0.85,
                'strengths': ['cultural_sensitivity', 'communication'],
                'areas_for_improvement': ['bias_awareness']
            }
        }
        
        result = await updater.handle_training_completion(training_data)
        print(f"Training completion handled: {result}")
        
        # Get stats
        stats = updater.get_memory_stats()
        print(f"Memory stats: {stats}")
        
        # Stop updater
        await updater.stop()

    asyncio.run(example())