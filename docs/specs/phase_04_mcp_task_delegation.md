# Phase 04: MCP Server Task Delegation and Queue Management

## Overview

This document provides modular pseudocode for the task delegation mechanism and queue management system, including task creation, assignment algorithms, priority queues, and real-time status tracking with comprehensive TDD anchors.

## Task Management Service

### 1. Task Creation and Validation

```python
# mcp_server/services/task_service.py
"""
Task Management Service
Handles task creation, validation, delegation, and lifecycle management
"""

// TEST: Create task service with dependencies
// INPUT: Service dependencies (database, Redis, etc.)
// EXPECTED: Initialized task service instance
class TaskService:
    """
    Service for managing task lifecycle and delegation
    
    Provides business logic for task creation, assignment, and monitoring
    """
    
    def __init__(self, db: Database, redis: Redis, agent_service: AgentService, audit_logger: AuditLogger):
        self.db = db
        self.redis = redis
        self.agent_service = agent_service
        self.audit_logger = audit_logger
        self.queue_manager = TaskQueueManager(redis)
        self.assignment_engine = TaskAssignmentEngine(agent_service, redis)
    
    // TEST: Create new task with validation
    // INPUT: Task creation request
    // EXPECTED: Created task with unique ID or validation error
    async def create_task(self, task_request: TaskCreateRequest) -> Task:
        """
        Create a new task with validation and initial setup
        
        Preconditions:
        - Pipeline must exist if pipeline_id is provided
        - Task type must be valid
        - Parameters must be valid for task type
        - Dependencies must exist and be valid
        
        Postconditions:
        - Task is created with unique ID
        - Task is validated and stored in database
        - Task is added to appropriate queue
        - Audit log entry is created
        
        // TEST: Validate task creation request
        // INPUT: Task creation data
        // EXPECTED: Validated data or validation error
        """
        
        // TEST: Validate task type
        if task_request.task_type not in TaskType:
            raise ValidationError(f"Invalid task type: {task_request.task_type}")
        
        // TEST: Validate pipeline association if provided
        if task_request.pipeline_id:
            pipeline = await self._get_pipeline(task_request.pipeline_id)
            if not pipeline:
                raise PipelineNotFoundError(f"Pipeline {task_request.pipeline_id} not found")
            
            // TEST: Validate stage number
            if task_request.stage < 1 or task_request.stage > len(pipeline.stages):
                raise ValidationError(f"Invalid stage number: {task_request.stage}")
        
        // TEST: Validate task parameters
        try:
            validated_params = await self._validate_task_parameters(
                task_request.task_type,
                task_request.parameters
            )
        except ValidationError as e:
            // TEST: Return validation error with details
            raise ValidationError(f"Invalid task parameters: {e}")
        
        // TEST: Validate dependencies
        if task_request.dependencies:
            await self._validate_dependencies(task_request.dependencies)
        
        // TEST: Generate unique task ID
        task_id = generate_uuid()
        
        // TEST: Calculate estimated duration
        estimated_duration = await self._estimate_task_duration(
            task_request.task_type,
            validated_params
        )
        
        // TEST: Create task entity
        task = Task(
            task_id=task_id,
            pipeline_id=task_request.pipeline_id,
            stage=task_request.stage,
            task_type=task_request.task_type,
            parameters=validated_params,
            priority=task_request.priority,
            deadline=task_request.deadline,
            dependencies=task_request.dependencies or [],
            max_retries=task_request.max_retries or 3,
            retry_count=0,
            status=TaskStatus.PENDING,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            estimated_duration=estimated_duration,
            metadata=task_request.metadata or {}
        )
        
        // TEST: Store task in database
        try:
            await self.db.tasks.insert_one(task.dict())
        except Exception as e:
            logger.error(f"Failed to store task: {e}")
            raise DatabaseError("Failed to create task")
        
        // TEST: Add task to queue
        try:
            await self.queue_manager.add_task(task)
        except Exception as e:
            logger.warning(f"Failed to queue task: {e}")
            // TEST: Don't fail task creation if queuing fails
        
        // TEST: Create audit log entry
        await self.audit_logger.log_task_created(
            task_id=task.task_id,
            task_type=task.task_type,
            pipeline_id=task.pipeline_id,
            stage=task.stage
        )
        
        // TEST: Trigger task assignment if no dependencies
        if not task.dependencies:
            await self._trigger_task_assignment(task_id)
        
        return task
    
    // TEST: Assign task to appropriate agent
    // INPUT: Task ID and assignment parameters
    // EXPECTED: Assigned task or assignment error
    async def assign_task(self, task_id: str, assignment_request: TaskAssignmentRequest) -> TaskAssignment:
        """
        Assign a task to an appropriate agent
        
        Preconditions:
        - Task must exist and be in PENDING status
        - Agent must exist and have required capabilities
        - Agent must have available capacity
        
        Postconditions:
        - Task is assigned to selected agent
        - Task status is updated to ASSIGNED
        - Agent current task count is updated
        - Assignment notification is sent
        
        // TEST: Retrieve task by ID
        // INPUT: Task ID
        // EXPECTED: Task entity or not found error
        """
        
        // TEST: Retrieve task
        task = await self._get_task(task_id)
        if not task:
            raise TaskNotFoundError(f"Task {task_id} not found")
        
        // TEST: Validate task status
        if task.status != TaskStatus.PENDING:
            raise TaskAssignmentError(f"Task {task_id} is not in PENDING status")
        
        // TEST: Validate task dependencies
        if not await self._are_dependencies_completed(task):
            raise TaskAssignmentError(f"Task {task_id} dependencies are not completed")
        
        // TEST: Find suitable agents
        suitable_agents = await self.assignment_engine.find_suitable_agents(task)
        if not suitable_agents:
            // TEST: Queue task for later assignment if no agents available
            await self.queue_manager.queue_task_for_assignment(task)
            raise NoSuitableAgentError("No suitable agents available for task")
        
        // TEST: Select best agent based on assignment strategy
        selected_agent = await self.assignment_engine.select_best_agent(
            task,
            suitable_agents,
            assignment_request.strategy
        )
        
        // TEST: Create task assignment
        assignment = TaskAssignment(
            assignment_id=generate_uuid(),
            task_id=task_id,
            agent_id=selected_agent.agent_id,
            assigned_at=datetime.utcnow(),
            status=AssignmentStatus.PENDING,
            priority=task.priority
        )
        
        // TEST: Update task with assignment
        try:
            await self.db.tasks.update_one(
                {"task_id": task_id},
                {
                    "$set": {
                        "assigned_agent_id": selected_agent.agent_id,
                        "status": TaskStatus.ASSIGNED,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
        except Exception as e:
            logger.error(f"Failed to update task assignment: {e}")
            raise DatabaseError("Failed to assign task")
        
        // TEST: Update agent task count
        try:
            await self.db.agents.update_one(
                {"agent_id": selected_agent.agent_id},
                {"$inc": {"current_tasks": 1}}
            )
        except Exception as e:
            logger.warning(f"Failed to update agent task count: {e}")
        
        // TEST: Cache assignment for fast retrieval
        await self._cache_assignment(assignment)
        
        // TEST: Send assignment notification
        await self._notify_agent_of_assignment(selected_agent.agent_id, task)
        
        // TEST: Create audit log entry
        await self.audit_logger.log_task_assigned(
            task_id=task_id,
            agent_id=selected_agent.agent_id,
            assignment_id=assignment.assignment_id
        )
        
        return assignment
    
    // TEST: Complete task with result
    // INPUT: Task ID and completion result
    // EXPECTED: Completed task or completion error
    async def complete_task(self, task_id: str, result: TaskResult) -> Task:
        """
        Mark task as completed with results
        
        Preconditions:
        - Task must exist and be in ASSIGNED or RUNNING status
        - Result must be valid for task type
        - Agent must be authorized to complete task
        
        Postconditions:
        - Task status is updated to COMPLETED
        - Task result is stored
        - Agent task count is decremented
        - Dependent tasks are evaluated for assignment
        - Pipeline progress is updated
        
        // TEST: Validate task completion result
        // INPUT: Task result data
        // EXPECTED: Validated result or validation error
        """
        
        // TEST: Retrieve task
        task = await self._get_task(task_id)
        if not task:
            raise TaskNotFoundError(f"Task {task_id} not found")
        
        // TEST: Validate task status
        if task.status not in [TaskStatus.ASSIGNED, TaskStatus.RUNNING]:
            raise TaskCompletionError(f"Task {task_id} is not in assignable status")
        
        // TEST: Validate result data
        try:
            validated_result = await self._validate_task_result(task.task_type, result)
        except ValidationError as e:
            raise TaskCompletionError(f"Invalid task result: {e}")
        
        // TEST: Update task with completion data
        completion_time = datetime.utcnow()
        update_data = {
            "status": TaskStatus.COMPLETED,
            "result": validated_result.dict(),
            "completed_at": completion_time,
            "updated_at": completion_time
        }
        
        try:
            await self.db.tasks.update_one(
                {"task_id": task_id},
                {"$set": update_data}
            )
        except Exception as e:
            logger.error(f"Failed to update task completion: {e}")
            raise DatabaseError("Failed to complete task")
        
        // TEST: Update agent task count
        if task.assigned_agent_id:
            try:
                await self.db.agents.update_one(
                    {"agent_id": task.assigned_agent_id},
                    {"$inc": {"current_tasks": -1}}
                )
            except Exception as e:
                logger.warning(f"Failed to update agent task count: {e}")
        
        // TEST: Remove from assignment cache
        if task.assigned_agent_id:
            await self._remove_cached_assignment(task_id)
        
        // TEST: Evaluate dependent tasks for assignment
        await self._evaluate_dependent_tasks(task_id)
        
        // TEST: Update pipeline progress if applicable
        if task.pipeline_id:
            await self._update_pipeline_progress(task.pipeline_id)
        
        // TEST: Create audit log entry
        await self.audit_logger.log_task_completed(
            task_id=task_id,
            agent_id=task.assigned_agent_id,
            processing_time=validated_result.processing_time
        )
        
        // TEST: Return updated task
        task.status = TaskStatus.COMPLETED
        task.result = validated_result
        task.completed_at = completion_time
        return task
    
    // TEST: Handle task failure with retry logic
    // INPUT: Task ID and failure details
    // EXPECTED: Failed task or retry scheduled
    async def fail_task(self, task_id: str, error: TaskError) -> Task:
        """
        Handle task failure with retry logic
        
        Preconditions:
        - Task must exist
        - Error details must be provided
        - Retry logic must be configured
        
        Postconditions:
        - Task status is updated to FAILED or RETRY
        - Error details are stored
        - Retry is scheduled if applicable
        - Agent task count is updated
        """
        
        // TEST: Retrieve task
        task = await self._get_task(task_id)
        if not task:
            raise TaskNotFoundError(f"Task {task_id} not found")
        
        // TEST: Validate error details
        if not error.code or not error.message:
            raise ValidationError("Error must have code and message")
        
        // TEST: Determine if task should be retried
        should_retry = (
            error.retryable and
            task.retry_count < task.max_retries and
            task.status in [TaskStatus.ASSIGNED, TaskStatus.RUNNING]
        )
        
        if should_retry:
            // TEST: Schedule task for retry
            await self._schedule_task_retry(task, error)
            new_status = TaskStatus.RETRY
        else:
            // TEST: Mark task as permanently failed
            new_status = TaskStatus.FAILED
        
        // TEST: Update task with failure data
        update_data = {
            "status": new_status,
            "error": error.dict(),
            "retry_count": task.retry_count + 1,
            "updated_at": datetime.utcnow()
        }
        
        try:
            await self.db.tasks.update_one(
                {"task_id": task_id},
                {"$set": update_data}
            )
        except Exception as e:
            logger.error(f"Failed to update task failure: {e}")
            raise DatabaseError("Failed to process task failure")
        
        // TEST: Update agent task count if assigned
        if task.assigned_agent_id and task.status in [TaskStatus.ASSIGNED, TaskStatus.RUNNING]:
            try:
                await self.db.agents.update_one(
                    {"agent_id": task.assigned_agent_id},
                    {"$inc": {"current_tasks": -1}}
                )
            except Exception as e:
                logger.warning(f"Failed to update agent task count: {e}")
        
        // TEST: Remove from assignment cache if retrying
        if should_retry:
            await self._remove_cached_assignment(task_id)
        
        // TEST: Create audit log entry
        await self.audit_logger.log_task_failed(
            task_id=task_id,
            agent_id=task.assigned_agent_id,
            error_code=error.code,
            retry_scheduled=should_retry
        )
        
        // TEST: Return updated task
        task.status = new_status
        task.error = error
        task.retry_count += 1
        return task
```

### 2. Task Assignment Engine

```python
# mcp_server/services/task_assignment_engine.py
"""
Task Assignment Engine
Implements intelligent task assignment algorithms with capability matching
"""

// TEST: Create assignment engine with dependencies
// INPUT: Agent service and Redis client
// EXPECTED: Initialized assignment engine
class TaskAssignmentEngine:
    """
    Engine for intelligent task assignment to suitable agents
    
    Implements multiple assignment strategies and capability matching
    """
    
    def __init__(self, agent_service: AgentService, redis: Redis):
        self.agent_service = agent_service
        self.redis = redis
        self.assignment_strategies = {
            'round_robin': RoundRobinStrategy(),
            'least_loaded': LeastLoadedStrategy(),
            'best_performance': BestPerformanceStrategy(),
            'capability_match': CapabilityMatchStrategy()
        }
    
    // TEST: Find agents suitable for task
    // INPUT: Task with requirements
    // EXPECTED: List of suitable agents sorted by suitability
    async def find_suitable_agents(self, task: Task) -> List[Agent]:
        """
        Find agents that can execute the given task
        
        Preconditions:
        - Task must have valid requirements
        - Agent service must be available
        
        Postconditions:
        - Returns list of agents with required capabilities
        - Agents are sorted by availability and performance
        - Only agents with available capacity are included
        
        // TEST: Extract task requirements
        // INPUT: Task entity
        // EXPECTED: Capability requirements and constraints
        """
        
        // TEST: Determine required capabilities
        required_capabilities = self._get_required_capabilities(task.task_type)
        
        // TEST: Find agents with required capabilities
        candidate_agents = await self.agent_service.find_agents_by_capabilities(
            required_capabilities,
            status=AgentStatus.ACTIVE
        )
        
        // TEST: Filter agents by availability
        available_agents = []
        for agent in candidate_agents:
            // TEST: Check agent capacity
            if agent.current_tasks < agent.max_concurrent_tasks:
                // TEST: Check agent health (recent heartbeat)
                if await self._is_agent_healthy(agent):
                    available_agents.append(agent)
        
        // TEST: Sort agents by assignment strategy
        suitable_agents = await self._sort_agents_by_suitability(
            available_agents,
            task
        )
        
        return suitable_agents
    
    // TEST: Select best agent from suitable candidates
    // INPUT: Task and list of suitable agents
    // EXPECTED: Selected agent based on strategy
    async def select_best_agent(
        self,
        task: Task,
        suitable_agents: List[Agent],
        strategy: str = 'capability_match'
    ) -> Agent:
        """
        Select the best agent from suitable candidates
        
        Preconditions:
        - Suitable agents list must not be empty
        - Strategy must be valid
        
        Postconditions:
        - Returns the selected agent
        - Selection is based on specified strategy
        - Tie-breaking is deterministic
        
        // TEST: Validate strategy parameter
        // INPUT: Strategy name
        // EXPECTED: Valid strategy or error
        """
        
        if not suitable_agents:
            raise NoSuitableAgentError("No suitable agents available")
        
        // TEST: Validate and get assignment strategy
        if strategy not in self.assignment_strategies:
            raise ValidationError(f"Invalid assignment strategy: {strategy}")
        
        assignment_strategy = self.assignment_strategies[strategy]
        
        // TEST: Apply assignment strategy
        selected_agent = await assignment_strategy.select_agent(
            task,
            suitable_agents,
            self.redis
        )
        
        return selected_agent
    
    // TEST: Check agent health status
    // INPUT: Agent entity
    // EXPECTED: Health status boolean
    async def _is_agent_healthy(self, agent: Agent) -> bool:
        """
        Check if agent is healthy based on recent heartbeat
        
        Preconditions:
        - Agent must have valid last_heartbeat timestamp
        
        Postconditions:
        - Returns True if agent is healthy
        - Returns False if agent has not sent recent heartbeat
        """
        
        // TEST: Check if heartbeat is recent (within 5 minutes)
        if not agent.last_heartbeat:
            return False
        
        time_since_heartbeat = datetime.utcnow() - agent.last_heartbeat
        max_acceptable_delay = timedelta(minutes=5)
        
        return time_since_heartbeat <= max_acceptable_delay
    
    // TEST: Get required capabilities for task type
    // INPUT: Task type enumeration
    // EXPECTED: List of required capability names
    def _get_required_capabilities(self, task_type: TaskType) -> List[str]:
        """
        Map task type to required capabilities
        
        Preconditions:
        - Task type must be valid
        
        Postconditions:
        - Returns list of required capabilities
        - Capabilities are sorted by importance
        """
        
        capability_mapping = {
            TaskType.TEXT_PREPROCESSING: ['text_processing', 'language_detection'],
            TaskType.BIAS_DETECTION: ['bias_detection', 'text_analysis'],
            TaskType.EMOTION_ANALYSIS: ['emotion_analysis', 'sentiment_analysis'],
            TaskType.EMPATHY_SCORING: ['empathy_scoring', 'text_analysis'],
            TaskType.THERAPEUTIC_RECOMMENDATIONS: ['therapeutic_knowledge', 'recommendation_generation'],
            TaskType.REPORT_GENERATION: ['report_generation', 'data_synthesis']
        }
        
        return capability_mapping.get(task_type, [])


// TEST: Implement round-robin assignment strategy
// INPUT: Task and list of agents
// EXPECTED: Agent selected in round-robin order
class RoundRobinStrategy:
    """
    Round-robin assignment strategy for load distribution
    """
    
    async def select_agent(self, task: Task, agents: List[Agent], redis: Redis) -> Agent:
        """
        Select agent using round-robin algorithm
        
        Preconditions:
        - Agents list must not be empty
        - Redis must be available for state tracking
        
        Postconditions:
        - Returns next agent in rotation
        - Updates round-robin counter in Redis
        """
        
        // TEST: Get current round-robin index
        counter_key = f"assignment:round_robin:{task.task_type}"
        current_index = await redis.get(counter_key)
        
        if current_index is None:
            current_index = 0
        else:
            current_index = int(current_index)
        
        // TEST: Select agent based on current index
        selected_agent = agents[current_index % len(agents)]
        
        // TEST: Update round-robin counter
        await redis.set(counter_key, (current_index + 1) % len(agents))
        
        return selected_agent


// TEST: Implement least-loaded assignment strategy
// INPUT: Task and list of agents
// EXPECTED: Agent with lowest current load selected
class LeastLoadedStrategy:
    """
    Least-loaded assignment strategy for optimal resource utilization
    """
    
    async def select_agent(self, task: Task, agents: List[Agent], redis: Redis) -> Agent:
        """
        Select agent with lowest current task load
        
        Preconditions:
        - Agents list must not be empty
        - Agent current_tasks must be accurate
        
        Postconditions:
        - Returns agent with lowest load
        - Tie-breaking uses agent ID for consistency
        """
        
        // TEST: Sort agents by current task count
        sorted_agents = sorted(agents, key=lambda agent: (agent.current_tasks, agent.agent_id))
        
        // TEST: Return least loaded agent
        return sorted_agents[0]


// TEST: Implement best-performance assignment strategy
// INPUT: Task and list of agents
// EXPECTED: Agent with best performance metrics selected
class BestPerformanceStrategy:
    """
    Best-performance assignment strategy for quality optimization
    """
    
    async def select_agent(self, task: Task, agents: List[Agent], redis: Redis) -> Agent:
        """
        Select agent with best performance metrics
        
        Preconditions:
        - Agents list must not be empty
        - Performance metrics must be available
        
        Postconditions:
        - Returns agent with highest performance score
        - Tie-breaking uses recent activity
        """
        
        // TEST: Calculate performance scores for agents
        agent_scores = []
        
        for agent in agents:
            // TEST: Get performance score from metrics
            score = await self._calculate_performance_score(agent)
            agent_scores.append((score, agent.last_heartbeat or datetime.min, agent))
        
        // TEST: Sort by score (descending) and last heartbeat (descending)
        agent_scores.sort(key=lambda x: (x[0], x[1]), reverse=True)
        
        // TEST: Return best performing agent
        return agent_scores[0][2]
    
    // TEST: Calculate performance score for agent
    // INPUT: Agent with metrics
    // EXPECTED: Numerical performance score
    async def _calculate_performance_score(self, agent: Agent) -> float:
        """
        Calculate composite performance score for agent
        
        Preconditions:
        - Agent must have performance metrics
        
        Postconditions:
        - Returns score between 0.0 and 1.0
        - Higher score indicates better performance
        """
        
        metrics = agent.performance_metrics
        
        // TEST: Calculate weighted performance score
        success_rate = metrics.success_rate
        avg_response_time = metrics.average_response_time
        
        // TEST: Normalize response time (lower is better)
        response_time_score = max(0.0, 1.0 - (avg_response_time / 10.0))  // 10s = 0 score
        
        // TEST: Calculate composite score
        composite_score = (success_rate * 0.7) + (response_time_score * 0.3)
        
        return max(0.0, min(1.0, composite_score))
```

### 3. Task Queue Manager

```python
# mcp_server/services/task_queue_manager.py
"""
Task Queue Manager
Implements Redis-backed priority queues for task management
"""

// TEST: Create queue manager with Redis connection
// INPUT: Redis client instance
// EXPECTED: Initialized queue manager
class TaskQueueManager:
    """
    Manager for task queues using Redis-backed priority queues
    
    Supports multiple queue types and priority levels
    """
    
    def __init__(self, redis: Redis):
        self.redis = redis
        self.queue_prefix = "task_queue"
        self.assignment_queue = "task_assignment_queue"
        self.dead_letter_queue = "task_dead_letter_queue"
    
    // TEST: Add task to appropriate queue
    // INPUT: Task entity
    // EXPECTED: Task queued with proper priority
    async def add_task(self, task: Task) -> None:
        """
        Add task to queue based on priority and type
        
        Preconditions:
        - Task must have valid priority
        - Redis connection must be available
        
        Postconditions:
        - Task is added to priority queue
        - Queue metrics are updated
        - Task is indexed by type and priority
        
        // TEST: Validate task priority
        // INPUT: Task priority value
        // EXPECTED: Valid priority or error
        """
        
        // TEST: Validate priority range
        if task.priority < 1 or task.priority > 10:
            raise ValidationError(f"Invalid task priority: {task.priority}")
        
        // TEST: Create queue entry
        queue_entry = TaskQueueEntry(
            task_id=task.task_id,
            priority=task.priority,
            task_type=task.task_type,
            pipeline_id=task.pipeline_id,
            stage=task.stage,
            queued_at=datetime.utcnow(),
            estimated_duration=task.estimated_duration
        )
        
        // TEST: Add to priority queue (sorted set)
        queue_key = f"{self.queue_prefix}:pending"
        score = self._calculate_priority_score(task)
        
        try:
            await self.redis.zadd(queue_key, {queue_entry.json(): score})
            
            // TEST: Update queue metrics
            await self._update_queue_metrics("add", task)
            
            // TEST: Add to type-specific index
            type_key = f"{self.queue_prefix}:type:{task.task_type}"
            await self.redis.sadd(type_key, task.task_id)
            
            // TEST: Add to pipeline index if applicable
            if task.pipeline_id:
                pipeline_key = f"{self.queue_prefix}:pipeline:{task.pipeline_id}"
                await self.redis.sadd(pipeline_key, task.task_id)
                
        except Exception as e:
            logger.error(f"Failed to add task to queue: {e}")
            raise QueueOperationError("Failed to queue task")
    
    // TEST: Get next task from queue
    // INPUT: Optional filters (type, priority range)
    // EXPECTED: Next available task or None
    async def get_next_task(self, filters: Optional[TaskFilters] = None) -> Optional[TaskQueueEntry]:
        """
        Retrieve next task from queue based on priority and filters
        
        Preconditions:
        - Queue must contain tasks
        - Filters must be valid if provided
        
        Postconditions:
        - Returns highest priority task matching filters
        - Task is removed from queue
        - Queue metrics are updated
        
        // TEST: Apply filters to task selection
        // INPUT: Filter criteria
        // EXPECTED: Filtered task queue or empty result
        """
        
        queue_key = f"{self.queue_prefix}:pending"
        
        // TEST: Build filter conditions
        filter_conditions = []
        if filters:
            if filters.task_types:
                filter_conditions.extend([
                    f"{self.queue_prefix}:type:{task_type}"
                    for task_type in filters.task_types
                ])
            
            if filters.min_priority:
                filter_conditions.append(f"priority>={filters.min_priority}")
            
            if filters.max_estimated_duration:
                filter_conditions.append(f"duration<={filters.max_estimated_duration}")
        
        // TEST: Get tasks from queue
        try:
            if filter_conditions:
                // TEST: Get filtered tasks
                task_entries = await self._get_filtered_tasks(filter_conditions)
            else:
                // TEST: Get all tasks (highest priority first)
                task_entries = await self.redis.zrevrange(queue_key, 0, -1)
            
            if not task_entries:
                return None
            
            // TEST: Parse and return first task
            for entry_json in task_entries:
                try:
                    task_entry = TaskQueueEntry.parse_raw(entry_json)
                    
                    // TEST: Remove task from queue
                    removed = await self.redis.zrem(queue_key, entry_json)
                    if removed:
                        // TEST: Update queue metrics
                        await self._update_queue_metrics("remove", task_entry)
                        return task_entry
                        
                except Exception as e:
                    logger.warning(f"Failed to parse queue entry: {e}")
                    continue
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get next task: {e}")
            raise QueueOperationError("Failed to retrieve task from queue")
    
    // TEST: Queue task for assignment retry
    // INPUT: Task that needs assignment
    // EXPECTED: Task queued for assignment with delay
    async def queue_task_for_assignment(self, task: Task) -> None:
        """
        Queue task for later assignment when agents become available
        
        Preconditions:
        - Task must be valid
        - Task must require assignment
        
        Postconditions:
        - Task is added to assignment queue with delay
        - Task will be retried for assignment
        """
        
        // TEST: Create delayed queue entry
        assignment_entry = AssignmentQueueEntry(
            task_id=task.task_id,
            priority=task.priority,
            retry_count=0,
            queued_at=datetime.utcnow(),
            retry_at=datetime.utcnow() + timedelta(seconds=30)  // 30 second delay
        )
        
        // TEST: Add to assignment queue (sorted set by retry time)
        assignment_key = self.assignment_queue
        score = assignment_entry.retry_at.timestamp()
        
        try:
            await self.redis.zadd(assignment_key, {assignment_entry.json(): score})
            logger.info(f"Task {task.task_id} queued for assignment retry")
            
        except Exception as e:
            logger.error(f"Failed to queue task for assignment: {e}")
            raise QueueOperationError("Failed to queue task for assignment")
    
    // TEST: Process assignment queue for ready tasks
    // INPUT: Current timestamp
    // EXPECTED: List of tasks ready for assignment
    async def process_assignment_queue(self) -> List[str]:
        """
        Process assignment queue and return tasks ready for assignment
        
        Preconditions:
        - Assignment queue must exist
        
        Postconditions:
        - Returns list of task IDs ready for assignment
        - Tasks are removed from assignment queue
        - Retry counts are updated
        """
        
        assignment_key = self.assignment_queue
        current_time = datetime.utcnow().timestamp()
        
        try:
            // TEST: Get tasks ready for assignment
            ready_entries = await self.redis.zrangebyscore(
                assignment_key,
                min=0,
                max=current_time
            )
            
            if not ready_entries:
                return []
            
            ready_task_ids = []
            
            // TEST: Process each ready entry
            for entry_json in ready_entries:
                try:
                    assignment_entry = AssignmentQueueEntry.parse_raw(entry_json)
                    
                    // TEST: Check retry limit
                    if assignment_entry.retry_count < 3:  // Max 3 retries
                        ready_task_ids.append(assignment_entry.task_id)
                        
                        // TEST: Update retry count and requeue if needed
                        assignment_entry.retry_count += 1
                        assignment_entry.retry_at = datetime.utcnow() + timedelta(
                            seconds=30 * (2 ** assignment_entry.retry_count)  // Exponential backoff
                        )
                        
                        // TEST: Requeue with new retry time
                        new_score = assignment_entry.retry_at.timestamp()
                        await self.redis.zadd(assignment_key, {assignment_entry.json(): new_score})
                    
                    // TEST: Remove original entry
                    await self.redis.zrem(assignment_key, entry_json)
                    
                except Exception as e:
                    logger.warning(f"Failed to process assignment entry: {e}")
                    continue
            
            return ready_task_ids
            
        except Exception as e:
            logger.error(f"Failed to process assignment queue: {e}")
            raise QueueOperationError("Failed to process assignment queue")
    
    // TEST: Calculate priority score for task
    // INPUT: Task entity
    // EXPECTED: Numerical priority score
    def _calculate_priority_score(self, task: Task) -> float:
        """
        Calculate priority score for task queue ordering
        
        Higher score = higher priority = processed first
        
        Preconditions:
        - Task must have valid priority
        
        Postconditions:
        - Returns numerical score for sorting
        - Score considers priority, age, and dependencies
        """
        
        // TEST: Base score from priority (higher priority = higher score)
        base_score = task.priority * 1000
        
        // TEST: Age bonus (older tasks get slight boost)
        age_hours = (datetime.utcnow() - task.created_at).total_seconds() / 3600
        age_bonus = min(age_hours * 10, 500)  // Max 500 point bonus
        
        // TEST: Dependency penalty (tasks with dependencies get slight penalty)
        dependency_penalty = len(task.dependencies) * 50
        
        // TEST: Pipeline bonus (pipeline tasks get priority)
        pipeline_bonus = 200 if task.pipeline_id else 0
        
        // TEST: Calculate final score
        final_score = base_score + age_bonus - dependency_penalty + pipeline_bonus
        
        return final_score
    
    // TEST: Update queue metrics
    // INPUT: Operation type and task data
    // EXPECTED: Updated metrics in Redis
    async def _update_queue_metrics(self, operation: str, task: Union[Task, TaskQueueEntry]) -> None:
        """
        Update queue metrics for monitoring
        
        Preconditions:
        - Operation must be 'add' or 'remove'
        - Task data must be valid
        
        Postconditions:
        - Queue size metrics are updated
        - Task type metrics are updated
        - Timestamp is recorded
        """
        
        metrics_key = f"{self.queue_prefix}:metrics"
        timestamp = datetime.utcnow().isoformat()
        
        try:
            // TEST: Update total queue size
            if operation == 'add':
                await self.redis.hincrby(metrics_key, "total_tasks", 1)
            elif operation == 'remove':
                await self.redis.hincrby(metrics_key, "total_tasks", -1)
            
            // TEST: Update task type metrics
            type_key = f"tasks_by_type:{task.task_type}"
            if operation == 'add':
                await self.redis.hincrby(metrics_key, type_key, 1)
            elif operation == 'remove':
                await self.redis.hincrby(metrics_key, type_key, -1)
            
            // TEST: Update last modified timestamp
            await self.redis.hset(metrics_key, "last_updated", timestamp)
            
        except Exception as e:
            logger.warning(f"Failed to update queue metrics: {e}")
```

### 4. Task Status Tracking

```python
# mcp_server/services/task_status_tracker.py
"""
Task Status Tracking Service
Provides real-time task status updates and progress monitoring
"""

// TEST: Create status tracker with event support
// INPUT: Database and Redis connections
// EXPECTED: Initialized status tracker
class TaskStatusTracker:
    """
    Service for tracking task status changes and progress
    
    Provides real-time status updates and historical tracking
    """
    
    def __init__(self, db: Database, redis: Redis, event_publisher: EventPublisher):
        self.db = db
        self.redis = redis
        self.event_publisher = event_publisher
        self.status_ttl = 3600  // 1 hour
    
    // TEST: Update task status with validation
    // INPUT: Task ID, new status, and metadata
    // EXPECTED: Updated task status or error
    async def update_task_status(
        self,
        task_id: str,
        new_status: TaskStatus,
        metadata: Optional[Dict[str, Any]] = None,
        agent_id: Optional[str] = None
    ) -> TaskStatusUpdate:
        """
        Update task status with validation and event publishing
        
        Preconditions:
        - Task must exist
        - Status transition must be valid
        - Agent must be authorized if specified
        
        Postconditions:
        - Task status is updated in database
        - Status change is cached for fast retrieval
        - Status change event is published
        - Audit log entry is created
        
        // TEST: Validate status transition
        // INPUT: Current status and new status
        // EXPECTED: Valid transition or error
        """
        
        // TEST: Retrieve current task status
        current_task = await self._get_task_from_cache(task_id)
        if not current_task:
            current_task = await self.db.tasks.find_one({"task_id": task_id})
            if not current_task:
                raise TaskNotFoundError(f"Task {task_id} not found")
        
        current_status = TaskStatus(current_task['status'])
        
        // TEST: Validate status transition
        if not self._is_valid_status_transition(current_status, new_status):
            raise InvalidStatusTransitionError(
                f"Invalid transition from {current_status} to {new_status}"
            )
        
        // TEST: Validate agent authorization
        if agent_id and current_task.get('assigned_agent_id') != agent_id:
            raise UnauthorizedStatusUpdateError(
                f"Agent {agent_id} is not authorized to update task {task_id}"
            )
        
        // TEST: Create status update record
        status_update = TaskStatusUpdate(
            task_id=task_id,
            previous_status=current_status,
            new_status=new_status,
            updated_at=datetime.utcnow(),
            updated_by=agent_id,
            metadata=metadata or {}
        )
        
        // TEST: Update task in database
        try:
            await self.db.tasks.update_one(
                {"task_id": task_id},
                {
                    "$set": {
                        "status": new_status,
                        "updated_at": status_update.updated_at
                    }
                }
            )
        except Exception as e:
            logger.error(f"Failed to update task status: {e}")
            raise DatabaseError("Failed to update task status")
        
        // TEST: Cache status update
        await self._cache_status_update(status_update)
        
        // TEST: Publish status change event
        await self._publish_status_event(status_update)
        
        // TEST: Create audit log entry
        await self._audit_status_change(status_update)
        
        return status_update
    
    // TEST: Get real-time task status
    // INPUT: Task ID
    // EXPECTED: Current task status and metadata
    async def get_task_status(self, task_id: str) -> TaskStatusInfo:
        """
        Get current task status with cached performance
        
        Preconditions:
        - Task ID must be valid
        
        Postconditions:
        - Returns current status information
        - Status is retrieved from cache if available
        - Falls back to database if not cached
        """
        
        // TEST: Check cache first
        cached_status = await self._get_cached_status(task_id)
        if cached_status:
            return cached_status
        
        // TEST: Query database if not cached
        task = await self.db.tasks.find_one({"task_id": task_id})
        if not task:
            raise TaskNotFoundError(f"Task {task_id} not found")
        
        // TEST: Build status information
        status_info = TaskStatusInfo(
            task_id=task_id,
            status=TaskStatus(task['status']),
            assigned_agent_id=task.get('assigned_agent_id'),
            created_at=task['created_at'],
            started_at=task.get('started_at'),
            completed_at=task.get('completed_at'),
            progress=self._calculate_task_progress(task),
            estimated_remaining_time=self._estimate_remaining_time(task),
            metadata=task.get('metadata', {})
        )
        
        // TEST: Cache status for future requests
        await self._cache_status_info(task_id, status_info)
        
        return status_info
    
    // TEST: Get task progress with detailed metrics
    // INPUT: Task ID and progress request
    // EXPECTED: Detailed progress information
    async def get_task_progress(self, task_id: str) -> TaskProgress:
        """
        Get detailed task progress with historical data
        
        Preconditions:
        - Task must exist
        - Progress data must be available
        
        Postconditions:
        - Returns detailed progress information
        - Includes historical progress data
        - Provides completion estimates
        """
        
        // TEST: Get current task data
        task = await self.db.tasks.find_one({"task_id": task_id})
        if not task:
            raise TaskNotFoundError(f"Task {task_id} not found")
        
        // TEST: Get status history
        status_history = await self._get_status_history(task_id)
        
        // TEST: Calculate progress metrics
        progress_metrics = await self._calculate_progress_metrics(task, status_history)
        
        // TEST: Build progress response
        task_progress = TaskProgress(
            task_id=task_id,
            current_status=TaskStatus(task['status']),
            overall_progress=progress_metrics.overall_progress,
            stage_progress=progress_metrics.stage_progress,
            time_metrics=progress_metrics.time_metrics,
            status_history=status_history,
            estimated_completion=progress_metrics.estimated_completion,
            confidence_score=progress_metrics.confidence_score
        )
        
        return task_progress
    
    // TEST: Subscribe to task status updates
    // INPUT: Task ID and callback function
    // EXPECTED: Subscription established with updates
    async def subscribe_to_status_updates(
        self,
        task_id: str,
        callback: Callable[[TaskStatusUpdate], Awaitable[None]]
    ) -> str:
        """
        Subscribe to real-time status updates for a task
        
        Preconditions:
        - Task must exist
        - Callback must be callable
        
        Postconditions:
        - Subscription is established
        - Callback will be invoked on status changes
        - Subscription ID is returned for management
        """
        
        // TEST: Validate task exists
        if not await self._task_exists(task_id):
            raise TaskNotFoundError(f"Task {task_id} not found")
        
        // TEST: Create subscription
        subscription_id = generate_uuid()
        
        // TEST: Register callback with event system
        await self.event_publisher.subscribe(
            event_type=f"task:status_changed:{task_id}",
            callback=callback,
            subscription_id=subscription_id
        )
        
        return subscription_id
    
    // TEST: Bulk status update for pipeline tasks
    // INPUT: Pipeline ID and status update
    // EXPECTED: Updated statuses for all pipeline tasks
    async def update_pipeline_task_statuses(
        self,
        pipeline_id: str,
        status_update: PipelineStatusUpdate
    ) -> List[TaskStatusUpdate]:
        """
        Update status for all tasks in a pipeline
        
        Preconditions:
        - Pipeline must exist
        - Status update must be valid
        
        Postconditions:
        - All pipeline tasks are updated
        - Status changes are validated per task
        - Bulk audit log entry is created
        """
        
        // TEST: Get all pipeline tasks
        pipeline_tasks = await self.db.tasks.find({
            "pipeline_id": pipeline_id
        }).to_list(None)
        
        if not pipeline_tasks:
            return []
        
        status_updates = []
        
        // TEST: Update each task status
        for task in pipeline_tasks:
            try:
                // TEST: Validate individual status transition
                if self._is_valid_status_transition(
                    TaskStatus(task['status']),
                    status_update.new_status
                ):
                    // TEST: Update individual task status
                    update = await self.update_task_status(
                        task_id=task['task_id'],
                        new_status=status_update.new_status,
                        metadata=status_update.metadata,
                        agent_id=status_update.updated_by
                    )
                    status_updates.append(update)
                    
            except Exception as e:
                logger.warning(f"Failed to update task {task['task_id']}: {e}")
                continue
        
        return status_updates
    
    // TEST: Validate status transition
    // INPUT: Current status and new status
    // EXPECTED: Boolean indicating validity
    def _is_valid_status_transition(self, current: TaskStatus, new: TaskStatus) -> bool:
        """
        Validate if status transition is allowed
        
        Preconditions:
        - Both statuses must be valid TaskStatus values
        
        Postconditions:
        - Returns True if transition is valid
        - Returns False if transition is invalid
        """
        
        // TEST: Define valid transitions
        valid_transitions = {
            TaskStatus.PENDING: [TaskStatus.ASSIGNED, TaskStatus.CANCELLED],
            TaskStatus.ASSIGNED: [TaskStatus.RUNNING, TaskStatus.FAILED, TaskStatus.CANCELLED],
            TaskStatus.RUNNING: [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.TIMEOUT],
            TaskStatus.COMPLETED: [],  // Terminal state
            TaskStatus.FAILED: [TaskStatus.RETRY, TaskStatus.CANCELLED],
            TaskStatus.RETRY: [TaskStatus.PENDING, TaskStatus.CANCELLED],
            TaskStatus.TIMEOUT: [TaskStatus.RETRY, TaskStatus.CANCELLED],
            TaskStatus.CANCELLED: []  // Terminal state
        }
        
        return new in valid_transitions.get(current, [])
    
    // TEST: Calculate task progress percentage
    // INPUT: Task data with timing information
    // EXPECTED: Progress percentage (0-100)
    def _calculate_task_progress(self, task: Dict[str, Any]) -> int:
        """
        Calculate task progress based on status and timing
        
        Preconditions:
        - Task must have valid status
        
        Postconditions:
        - Returns progress percentage (0-100)
        - Progress is based on status and estimated duration
        """
        
        status = TaskStatus(task['status'])
        
        // TEST: Map status to progress
        status_progress = {
            TaskStatus.PENDING: 0,
            TaskStatus.ASSIGNED: 10,
            TaskStatus.RUNNING: 50,
            TaskStatus.COMPLETED: 100,
            TaskStatus.FAILED: 100,
            TaskStatus.RETRY: 0,
            TaskStatus.TIMEOUT: 90,
            TaskStatus.CANCELLED: 100
        }
        
        base_progress = status_progress.get(status, 0)
        
        // TEST: Adjust progress for running tasks based on time
        if status == TaskStatus.RUNNING and task.get('started_at'):
            elapsed = (datetime.utcnow() - task['started_at']).total_seconds()
            estimated = task.get('estimated_duration', 300)  // Default 5 minutes
            
            if elapsed > 0 and estimated > 0:
                time_progress = min(90, int((elapsed / estimated) * 40))  // Cap at 90%
                base_progress = 50 + time_progress  // Start at 50%, cap at 90%
        
        return min(100, max(0, base_progress))
    
    // TEST: Cache status update in Redis
    // INPUT: Status update record
    // EXPECTED: Cached status with TTL
    async def _cache_status_update(self, status_update: TaskStatusUpdate) -> None:
        """
        Cache status update for fast retrieval
        
        Preconditions:
        - Status update must be valid
        - Redis connection must be available
        
        Postconditions:
        - Status is cached with TTL
        - Status history is maintained
        """
        
        try:
            // TEST: Cache current status
            cache_key = f"task:status:{status_update.task_id}"
            await self.redis.setex(
                cache_key,
                self.status_ttl,
                status_update.json()
            )
            
            // TEST: Add to status history
            history_key = f"task:status_history:{status_update.task_id}"
            await self.redis.lpush(history_key, status_update.json())
            await self.redis.ltrim(history_key, 0, 99)  // Keep last 100 entries
            await self.redis.expire(history_key, self.status_ttl * 24)  // 24 hour history
            
        except Exception as e:
            logger.warning(f"Failed to cache status update: {e}")
```

This comprehensive pseudocode provides the task delegation and queue management system with extensive TDD anchors covering task creation, assignment algorithms, priority queues, status tracking, and real-time monitoring. The design emphasizes scalability, reliability, and performance while maintaining clear separation of concerns and comprehensive error handling.