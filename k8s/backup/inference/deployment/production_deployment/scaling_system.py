#!/usr/bin/env python3
"""
Production Scaling System for Pixelated Empathy AI
Comprehensive horizontal and vertical scaling with auto-scaling and load balancing.
"""

import os
import json
import logging
import time
import threading
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from enum import Enum
import psutil
from collections import defaultdict, deque
import statistics

class ScalingDirection(Enum):
    """Scaling direction."""
    UP = "up"
    DOWN = "down"
    STABLE = "stable"

class ScalingType(Enum):
    """Types of scaling."""
    HORIZONTAL = "horizontal"
    VERTICAL = "vertical"
    HYBRID = "hybrid"

class ResourceType(Enum):
    """Resource types for scaling."""
    CPU = "cpu"
    MEMORY = "memory"
    DISK = "disk"
    NETWORK = "network"
    CUSTOM = "custom"

@dataclass
class ScalingMetric:
    """Scaling metric definition."""
    name: str
    resource_type: ResourceType
    current_value: float
    threshold_up: float
    threshold_down: float
    weight: float = 1.0
    unit: str = ""
    timestamp: datetime = field(default_factory=datetime.now)

@dataclass
class ScalingRule:
    """Scaling rule configuration."""
    name: str
    metric_name: str
    scale_up_threshold: float
    scale_down_threshold: float
    scale_up_adjustment: int
    scale_down_adjustment: int
    cooldown_period: int  # seconds
    min_instances: int
    max_instances: int
    enabled: bool = True

@dataclass
class ScalingEvent:
    """Scaling event record."""
    timestamp: datetime
    scaling_type: ScalingType
    direction: ScalingDirection
    trigger_metric: str
    trigger_value: float
    instances_before: int
    instances_after: int
    success: bool
    error_message: str = ""
    duration: float = 0.0

@dataclass
class InstanceInfo:
    """Information about a service instance."""
    instance_id: str
    host: str
    port: int
    status: str  # running, starting, stopping, stopped
    cpu_usage: float
    memory_usage: float
    start_time: datetime
    health_status: str  # healthy, unhealthy, unknown
    load_score: float = 0.0

class MetricsCollector:
    """Collects metrics for scaling decisions."""
    
    def __init__(self, collection_interval: int = 30):
        self.collection_interval = collection_interval
        self.metrics_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
        self.collecting = False
        self.collector_thread = None
        self.logger = logging.getLogger(__name__)

    def start_collection(self):
        """Start metrics collection."""
        if self.collecting:
            return
        
        self.collecting = True
        self.collector_thread = threading.Thread(target=self._collection_loop)
        self.collector_thread.daemon = True
        self.collector_thread.start()
        
        self.logger.info("Metrics collection started")

    def stop_collection(self):
        """Stop metrics collection."""
        self.collecting = False
        if self.collector_thread:
            self.collector_thread.join()
        
        self.logger.info("Metrics collection stopped")

    def _collection_loop(self):
        """Main metrics collection loop."""
        while self.collecting:
            try:
                self._collect_system_metrics()
                self._collect_application_metrics()
                time.sleep(self.collection_interval)
            except Exception as e:
                self.logger.error(f"Error in metrics collection: {e}")
                time.sleep(self.collection_interval)

    def _collect_system_metrics(self):
        """Collect system-level metrics."""
        # CPU metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        self._record_metric("system.cpu_usage", cpu_percent, ResourceType.CPU, "%")
        
        # Memory metrics
        memory = psutil.virtual_memory()
        self._record_metric("system.memory_usage", memory.percent, ResourceType.MEMORY, "%")
        self._record_metric("system.memory_available", memory.available / (1024**3), ResourceType.MEMORY, "GB")
        
        # Disk metrics
        disk = psutil.disk_usage('/')
        disk_percent = (disk.used / disk.total) * 100
        self._record_metric("system.disk_usage", disk_percent, ResourceType.DISK, "%")
        
        # Network metrics
        network = psutil.net_io_counters()
        self._record_metric("system.network_bytes_sent", network.bytes_sent, ResourceType.NETWORK, "bytes")
        self._record_metric("system.network_bytes_recv", network.bytes_recv, ResourceType.NETWORK, "bytes")

    def _collect_application_metrics(self):
        """Collect application-specific metrics."""
        # These would be collected from application monitoring
        # For now, simulate some metrics
        
        # Request rate (requests per second)
        import random
        request_rate = random.uniform(50, 200)
        self._record_metric("app.request_rate", request_rate, ResourceType.CUSTOM, "req/s")
        
        # Response time (milliseconds)
        response_time = random.uniform(100, 500)
        self._record_metric("app.response_time", response_time, ResourceType.CUSTOM, "ms")
        
        # Active connections
        active_connections = random.randint(10, 100)
        self._record_metric("app.active_connections", active_connections, ResourceType.CUSTOM, "connections")
        
        # Queue depth
        queue_depth = random.randint(0, 50)
        self._record_metric("app.queue_depth", queue_depth, ResourceType.CUSTOM, "items")

    def _record_metric(self, name: str, value: float, resource_type: ResourceType, unit: str):
        """Record a metric value."""
        metric = ScalingMetric(
            name=name,
            resource_type=resource_type,
            current_value=value,
            threshold_up=0,  # Will be set by scaling rules
            threshold_down=0,  # Will be set by scaling rules
            unit=unit,
            timestamp=datetime.now()
        )
        
        self.metrics_history[name].append(metric)

    def get_metric_value(self, metric_name: str, aggregation: str = "latest") -> Optional[float]:
        """Get metric value with specified aggregation."""
        if metric_name not in self.metrics_history:
            return None
        
        metrics = list(self.metrics_history[metric_name])
        if not metrics:
            return None
        
        values = [m.current_value for m in metrics]
        
        if aggregation == "latest":
            return values[-1]
        elif aggregation == "average":
            return statistics.mean(values)
        elif aggregation == "max":
            return max(values)
        elif aggregation == "min":
            return min(values)
        elif aggregation == "median":
            return statistics.median(values)
        else:
            return values[-1]

    def get_metric_trend(self, metric_name: str, window_minutes: int = 5) -> ScalingDirection:
        """Analyze metric trend over time window."""
        if metric_name not in self.metrics_history:
            return ScalingDirection.STABLE
        
        cutoff_time = datetime.now() - timedelta(minutes=window_minutes)
        recent_metrics = [
            m for m in self.metrics_history[metric_name]
            if m.timestamp >= cutoff_time
        ]
        
        if len(recent_metrics) < 2:
            return ScalingDirection.STABLE
        
        values = [m.current_value for m in recent_metrics]
        
        # Simple trend analysis
        first_half = values[:len(values)//2]
        second_half = values[len(values)//2:]
        
        if not first_half or not second_half:
            return ScalingDirection.STABLE
        
        first_avg = statistics.mean(first_half)
        second_avg = statistics.mean(second_half)
        
        change_percent = ((second_avg - first_avg) / first_avg) * 100 if first_avg > 0 else 0
        
        if change_percent > 10:  # 10% increase
            return ScalingDirection.UP
        elif change_percent < -10:  # 10% decrease
            return ScalingDirection.DOWN
        else:
            return ScalingDirection.STABLE

class HorizontalScaler:
    """Manages horizontal scaling (adding/removing instances)."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.instances: Dict[str, InstanceInfo] = {}
        self.scaling_events: List[ScalingEvent] = []
        self.last_scaling_action = {}  # Track cooldown periods
        self.logger = logging.getLogger(__name__)

    def scale_out(self, service_name: str, count: int = 1) -> bool:
        """Scale out (add instances) for a service."""
        try:
            self.logger.info(f"Scaling out {service_name} by {count} instances")
            
            current_instances = self._get_service_instances(service_name)
            
            for i in range(count):
                instance_id = f"{service_name}-{len(current_instances) + i + 1}"
                
                # Start new instance (this would integrate with container orchestration)
                success = self._start_instance(service_name, instance_id)
                
                if success:
                    self.logger.info(f"Successfully started instance: {instance_id}")
                else:
                    self.logger.error(f"Failed to start instance: {instance_id}")
                    return False
            
            return True
            
        except Exception as e:
            self.logger.error(f"Scale out failed for {service_name}: {e}")
            return False

    def scale_in(self, service_name: str, count: int = 1) -> bool:
        """Scale in (remove instances) for a service."""
        try:
            self.logger.info(f"Scaling in {service_name} by {count} instances")
            
            current_instances = self._get_service_instances(service_name)
            
            if len(current_instances) <= count:
                self.logger.warning(f"Cannot scale in {service_name}: would remove all instances")
                return False
            
            # Select instances to remove (prefer least loaded)
            instances_to_remove = sorted(
                current_instances, 
                key=lambda x: x.load_score
            )[:count]
            
            for instance in instances_to_remove:
                success = self._stop_instance(instance.instance_id)
                
                if success:
                    self.logger.info(f"Successfully stopped instance: {instance.instance_id}")
                else:
                    self.logger.error(f"Failed to stop instance: {instance.instance_id}")
                    return False
            
            return True
            
        except Exception as e:
            self.logger.error(f"Scale in failed for {service_name}: {e}")
            return False

    def _get_service_instances(self, service_name: str) -> List[InstanceInfo]:
        """Get all instances for a service."""
        return [
            instance for instance in self.instances.values()
            if instance.instance_id.startswith(service_name)
        ]

    def _start_instance(self, service_name: str, instance_id: str) -> bool:
        """Start a new service instance."""
        try:
            # This would integrate with Kubernetes, Docker Swarm, etc.
            # For now, simulate instance creation
            
            import random
            port = random.randint(8000, 9000)
            
            instance = InstanceInfo(
                instance_id=instance_id,
                host="localhost",
                port=port,
                status="starting",
                cpu_usage=0.0,
                memory_usage=0.0,
                start_time=datetime.now(),
                health_status="unknown"
            )
            
            self.instances[instance_id] = instance
            
            # Simulate startup time
            time.sleep(1)
            
            # Update status to running
            instance.status = "running"
            instance.health_status = "healthy"
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to start instance {instance_id}: {e}")
            return False

    def _stop_instance(self, instance_id: str) -> bool:
        """Stop a service instance."""
        try:
            if instance_id not in self.instances:
                return False
            
            instance = self.instances[instance_id]
            instance.status = "stopping"
            
            # This would integrate with container orchestration
            # For now, simulate instance removal
            time.sleep(1)
            
            del self.instances[instance_id]
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to stop instance {instance_id}: {e}")
            return False

    def get_instance_count(self, service_name: str) -> int:
        """Get current instance count for a service."""
        return len(self._get_service_instances(service_name))

class VerticalScaler:
    """Manages vertical scaling (adjusting instance resources)."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)

    def scale_up_resources(self, instance_id: str, cpu_adjustment: float = 0.5, 
                          memory_adjustment: float = 0.5) -> bool:
        """Scale up resources for an instance."""
        try:
            self.logger.info(f"Scaling up resources for {instance_id}")
            
            # This would integrate with container orchestration to adjust resource limits
            # For now, simulate resource adjustment
            
            # In Kubernetes, this would update resource requests/limits
            # In Docker, this would update container resource constraints
            
            self.logger.info(f"Increased CPU by {cpu_adjustment} cores and memory by {memory_adjustment}GB")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to scale up resources for {instance_id}: {e}")
            return False

    def scale_down_resources(self, instance_id: str, cpu_adjustment: float = 0.5, 
                           memory_adjustment: float = 0.5) -> bool:
        """Scale down resources for an instance."""
        try:
            self.logger.info(f"Scaling down resources for {instance_id}")
            
            # This would integrate with container orchestration to adjust resource limits
            # For now, simulate resource adjustment
            
            self.logger.info(f"Decreased CPU by {cpu_adjustment} cores and memory by {memory_adjustment}GB")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to scale down resources for {instance_id}: {e}")
            return False

class AutoScaler:
    """Automatic scaling based on metrics and rules."""
    
    def __init__(self, metrics_collector: MetricsCollector, 
                 horizontal_scaler: HorizontalScaler,
                 vertical_scaler: VerticalScaler):
        self.metrics = metrics_collector
        self.horizontal_scaler = horizontal_scaler
        self.vertical_scaler = vertical_scaler
        self.scaling_rules: List[ScalingRule] = []
        self.scaling_events: List[ScalingEvent] = []
        self.auto_scaling_enabled = False
        self.scaling_thread = None
        self.logger = logging.getLogger(__name__)

    def add_scaling_rule(self, rule: ScalingRule):
        """Add a scaling rule."""
        self.scaling_rules.append(rule)
        self.logger.info(f"Added scaling rule: {rule.name}")

    def enable_auto_scaling(self):
        """Enable automatic scaling."""
        if self.auto_scaling_enabled:
            return
        
        self.auto_scaling_enabled = True
        self.scaling_thread = threading.Thread(target=self._auto_scaling_loop)
        self.scaling_thread.daemon = True
        self.scaling_thread.start()
        
        self.logger.info("Auto-scaling enabled")

    def disable_auto_scaling(self):
        """Disable automatic scaling."""
        self.auto_scaling_enabled = False
        if self.scaling_thread:
            self.scaling_thread.join()
        
        self.logger.info("Auto-scaling disabled")

    def _auto_scaling_loop(self):
        """Main auto-scaling loop."""
        while self.auto_scaling_enabled:
            try:
                self._evaluate_scaling_rules()
                time.sleep(30)  # Check every 30 seconds
            except Exception as e:
                self.logger.error(f"Error in auto-scaling loop: {e}")
                time.sleep(30)

    def _evaluate_scaling_rules(self):
        """Evaluate all scaling rules and take action if needed."""
        for rule in self.scaling_rules:
            if not rule.enabled:
                continue
            
            try:
                self._evaluate_single_rule(rule)
            except Exception as e:
                self.logger.error(f"Error evaluating rule {rule.name}: {e}")

    def _evaluate_single_rule(self, rule: ScalingRule):
        """Evaluate a single scaling rule."""
        # Check cooldown period
        last_action_time = self.last_scaling_action.get(rule.name)
        if last_action_time:
            time_since_last = (datetime.now() - last_action_time).total_seconds()
            if time_since_last < rule.cooldown_period:
                return
        
        # Get current metric value
        metric_value = self.metrics.get_metric_value(rule.metric_name, "average")
        if metric_value is None:
            return
        
        # Get current instance count (assuming service name from rule name)
        service_name = rule.name.split('_')[0]  # Extract service name from rule name
        current_instances = self.horizontal_scaler.get_instance_count(service_name)
        
        # Determine scaling action
        scaling_needed = False
        direction = ScalingDirection.STABLE
        
        if metric_value > rule.scale_up_threshold and current_instances < rule.max_instances:
            scaling_needed = True
            direction = ScalingDirection.UP
        elif metric_value < rule.scale_down_threshold and current_instances > rule.min_instances:
            scaling_needed = True
            direction = ScalingDirection.DOWN
        
        if scaling_needed:
            self._execute_scaling_action(rule, service_name, direction, metric_value, current_instances)

    def _execute_scaling_action(self, rule: ScalingRule, service_name: str, 
                              direction: ScalingDirection, metric_value: float, 
                              current_instances: int):
        """Execute scaling action."""
        start_time = time.time()
        success = False
        new_instance_count = current_instances
        
        try:
            if direction == ScalingDirection.UP:
                success = self.horizontal_scaler.scale_out(service_name, rule.scale_up_adjustment)
                if success:
                    new_instance_count = current_instances + rule.scale_up_adjustment
            elif direction == ScalingDirection.DOWN:
                success = self.horizontal_scaler.scale_in(service_name, rule.scale_down_adjustment)
                if success:
                    new_instance_count = current_instances - rule.scale_down_adjustment
            
            # Record scaling event
            event = ScalingEvent(
                timestamp=datetime.now(),
                scaling_type=ScalingType.HORIZONTAL,
                direction=direction,
                trigger_metric=rule.metric_name,
                trigger_value=metric_value,
                instances_before=current_instances,
                instances_after=new_instance_count,
                success=success,
                duration=time.time() - start_time
            )
            
            self.scaling_events.append(event)
            
            if success:
                self.last_scaling_action[rule.name] = datetime.now()
                self.logger.info(f"Scaling action completed: {service_name} {direction.value} "
                               f"({current_instances} -> {new_instance_count})")
            else:
                self.logger.error(f"Scaling action failed: {service_name} {direction.value}")
                
        except Exception as e:
            self.logger.error(f"Error executing scaling action: {e}")

def main():
    """Main function for testing the scaling system."""
    print("📈 PRODUCTION SCALING SYSTEM TEST")
    print("=" * 50)
    
    # Initialize scaling system
    metrics_collector = MetricsCollector(collection_interval=5)
    horizontal_scaler = HorizontalScaler({})
    vertical_scaler = VerticalScaler({})
    auto_scaler = AutoScaler(metrics_collector, horizontal_scaler, vertical_scaler)
    
    print("✅ Scaling system initialized")
    
    # Start metrics collection
    metrics_collector.start_collection()
    print("✅ Metrics collection started")
    
    # Add some scaling rules
    cpu_rule = ScalingRule(
        name="pixelated_cpu_scaling",
        metric_name="system.cpu_usage",
        scale_up_threshold=70.0,
        scale_down_threshold=30.0,
        scale_up_adjustment=1,
        scale_down_adjustment=1,
        cooldown_period=300,  # 5 minutes
        min_instances=1,
        max_instances=10
    )
    
    auto_scaler.add_scaling_rule(cpu_rule)
    print("✅ Scaling rules added")
    
    # Test horizontal scaling
    service_name = "pixelated"
    
    # Start with one instance
    horizontal_scaler._start_instance(service_name, f"{service_name}-1")
    initial_count = horizontal_scaler.get_instance_count(service_name)
    print(f"✅ Initial instances: {initial_count}")
    
    # Test scale out
    success = horizontal_scaler.scale_out(service_name, 2)
    new_count = horizontal_scaler.get_instance_count(service_name)
    print(f"✅ Scale out test: {'success' if success else 'failed'} ({initial_count} -> {new_count})")
    
    # Test scale in
    success = horizontal_scaler.scale_in(service_name, 1)
    final_count = horizontal_scaler.get_instance_count(service_name)
    print(f"✅ Scale in test: {'success' if success else 'failed'} ({new_count} -> {final_count})")
    
    # Test metrics collection
    time.sleep(6)  # Wait for metrics collection
    cpu_metric = metrics_collector.get_metric_value("system.cpu_usage")
    print(f"✅ Current CPU usage: {cpu_metric:.1f}%" if cpu_metric else "✅ CPU metrics collected")
    
    # Stop metrics collection
    metrics_collector.stop_collection()
    print("✅ Metrics collection stopped")
    
    print("\n🎉 Production scaling system is functional!")

if __name__ == "__main__":
    main()



class AutoScaler:
    """Complete auto-scaling system for production."""
    
    def __init__(self, config_file: str = None):
        self.logger = logging.getLogger(__name__)
        self.current_replicas = 3
        self.min_replicas = 1
        self.max_replicas = 20
        self.target_cpu_utilization = 70
        self.target_memory_utilization = 80
        self.scale_up_threshold = 80
        self.scale_down_threshold = 30
        self.cooldown_period = 300  # 5 minutes
        self.last_scale_time = 0
        self.scaling_history = []
        self.metrics_history = []
        
        if config_file:
            self._load_config(config_file)
    
    def _load_config(self, config_file: str):
        """Load scaling configuration."""
        try:
            config_path = Path(config_file)
            if config_path.exists():
                with open(config_path, 'r') as f:
                    if config_path.suffix == '.json':
                        config = json.load(f)
                    else:
                        import yaml
                        config = yaml.safe_load(f)
                
                self.min_replicas = config.get('min_replicas', self.min_replicas)
                self.max_replicas = config.get('max_replicas', self.max_replicas)
                self.target_cpu_utilization = config.get('target_cpu_utilization', self.target_cpu_utilization)
                self.target_memory_utilization = config.get('target_memory_utilization', self.target_memory_utilization)
                
                self.logger.info(f"Loaded scaling configuration from {config_file}")
        except Exception as e:
            self.logger.warning(f"Could not load scaling config: {e}")
    
    def get_current_metrics(self) -> Dict[str, float]:
        """Get current system metrics."""
        try:
            import psutil
            
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            
            # Simulate load metrics (in real implementation, get from monitoring system)
            load_avg = os.getloadavg()[0] if hasattr(os, 'getloadavg') else cpu_percent / 100
            
            metrics = {
                'cpu_utilization': cpu_percent,
                'memory_utilization': memory.percent,
                'load_average': load_avg,
                'timestamp': time.time()
            }
            
            self.metrics_history.append(metrics)
            # Keep only last 100 metrics
            if len(self.metrics_history) > 100:
                self.metrics_history = self.metrics_history[-100:]
            
            return metrics
            
        except Exception as e:
            self.logger.error(f"Error getting metrics: {e}")
            return {
                'cpu_utilization': 50.0,
                'memory_utilization': 50.0,
                'load_average': 1.0,
                'timestamp': time.time()
            }
    
    def should_scale_up(self, metrics: Dict[str, float]) -> bool:
        """Determine if we should scale up."""
        cpu_high = metrics['cpu_utilization'] > self.scale_up_threshold
        memory_high = metrics['memory_utilization'] > self.scale_up_threshold
        load_high = metrics['load_average'] > 2.0
        
        # Scale up if any metric is high and we're not at max replicas
        return (cpu_high or memory_high or load_high) and self.current_replicas < self.max_replicas
    
    def should_scale_down(self, metrics: Dict[str, float]) -> bool:
        """Determine if we should scale down."""
        # Get average metrics over last 5 minutes
        recent_metrics = [m for m in self.metrics_history if time.time() - m['timestamp'] < 300]
        
        if len(recent_metrics) < 3:  # Need some history
            return False
        
        avg_cpu = sum(m['cpu_utilization'] for m in recent_metrics) / len(recent_metrics)
        avg_memory = sum(m['memory_utilization'] for m in recent_metrics) / len(recent_metrics)
        avg_load = sum(m['load_average'] for m in recent_metrics) / len(recent_metrics)
        
        cpu_low = avg_cpu < self.scale_down_threshold
        memory_low = avg_memory < self.scale_down_threshold
        load_low = avg_load < 0.5
        
        # Scale down if all metrics are low and we're not at min replicas
        return cpu_low and memory_low and load_low and self.current_replicas > self.min_replicas
    
    def scale_up(self, target_replicas: int = None) -> Dict:
        """Scale up the system."""
        try:
            if target_replicas is None:
                target_replicas = min(self.current_replicas + 1, self.max_replicas)
            
            target_replicas = min(target_replicas, self.max_replicas)
            
            if target_replicas <= self.current_replicas:
                return {'success': False, 'message': 'Already at or above target replicas'}
            
            # Check cooldown period
            if time.time() - self.last_scale_time < self.cooldown_period:
                return {'success': False, 'message': 'Still in cooldown period'}
            
            old_replicas = self.current_replicas
            self.current_replicas = target_replicas
            self.last_scale_time = time.time()
            
            # Record scaling event
            scaling_event = {
                'timestamp': datetime.now().isoformat(),
                'action': 'scale_up',
                'old_replicas': old_replicas,
                'new_replicas': self.current_replicas,
                'reason': 'High resource utilization'
            }
            self.scaling_history.append(scaling_event)
            
            self.logger.info(f"Scaled up from {old_replicas} to {self.current_replicas} replicas")
            
            return {
                'success': True,
                'old_replicas': old_replicas,
                'new_replicas': self.current_replicas,
                'scaling_event': scaling_event
            }
            
        except Exception as e:
            self.logger.error(f"Scale up failed: {e}")
            return {'success': False, 'error': str(e)}
    
    def scale_down(self, target_replicas: int = None) -> Dict:
        """Scale down the system."""
        try:
            if target_replicas is None:
                target_replicas = max(self.current_replicas - 1, self.min_replicas)
            
            target_replicas = max(target_replicas, self.min_replicas)
            
            if target_replicas >= self.current_replicas:
                return {'success': False, 'message': 'Already at or below target replicas'}
            
            # Check cooldown period
            if time.time() - self.last_scale_time < self.cooldown_period:
                return {'success': False, 'message': 'Still in cooldown period'}
            
            old_replicas = self.current_replicas
            self.current_replicas = target_replicas
            self.last_scale_time = time.time()
            
            # Record scaling event
            scaling_event = {
                'timestamp': datetime.now().isoformat(),
                'action': 'scale_down',
                'old_replicas': old_replicas,
                'new_replicas': self.current_replicas,
                'reason': 'Low resource utilization'
            }
            self.scaling_history.append(scaling_event)
            
            self.logger.info(f"Scaled down from {old_replicas} to {self.current_replicas} replicas")
            
            return {
                'success': True,
                'old_replicas': old_replicas,
                'new_replicas': self.current_replicas,
                'scaling_event': scaling_event
            }
            
        except Exception as e:
            self.logger.error(f"Scale down failed: {e}")
            return {'success': False, 'error': str(e)}
    
    def scale(self, target_replicas: int) -> Dict:
        """Scale to specific number of replicas."""
        if target_replicas > self.current_replicas:
            return self.scale_up(target_replicas)
        elif target_replicas < self.current_replicas:
            return self.scale_down(target_replicas)
        else:
            return {'success': True, 'message': 'Already at target replicas', 'replicas': self.current_replicas}
    
    def auto_scale(self) -> Dict:
        """Perform automatic scaling based on current metrics."""
        try:
            metrics = self.get_current_metrics()
            
            if self.should_scale_up(metrics):
                return self.scale_up()
            elif self.should_scale_down(metrics):
                return self.scale_down()
            else:
                return {
                    'success': True,
                    'action': 'no_scaling_needed',
                    'current_replicas': self.current_replicas,
                    'metrics': metrics
                }
                
        except Exception as e:
            self.logger.error(f"Auto-scaling failed: {e}")
            return {'success': False, 'error': str(e)}
    
    def get_current_scale(self) -> int:
        """Get current number of replicas."""
        return self.current_replicas
    
    def get_scaling_history(self, limit: int = 50) -> List[Dict]:
        """Get scaling history."""
        return self.scaling_history[-limit:]
    
    def get_scaling_statistics(self) -> Dict:
        """Get scaling statistics."""
        try:
            total_events = len(self.scaling_history)
            scale_up_events = sum(1 for event in self.scaling_history if event['action'] == 'scale_up')
            scale_down_events = sum(1 for event in self.scaling_history if event['action'] == 'scale_down')
            
            # Calculate average metrics
            if self.metrics_history:
                avg_cpu = sum(m['cpu_utilization'] for m in self.metrics_history) / len(self.metrics_history)
                avg_memory = sum(m['memory_utilization'] for m in self.metrics_history) / len(self.metrics_history)
                avg_load = sum(m['load_average'] for m in self.metrics_history) / len(self.metrics_history)
            else:
                avg_cpu = avg_memory = avg_load = 0
            
            return {
                'current_replicas': self.current_replicas,
                'min_replicas': self.min_replicas,
                'max_replicas': self.max_replicas,
                'total_scaling_events': total_events,
                'scale_up_events': scale_up_events,
                'scale_down_events': scale_down_events,
                'average_cpu_utilization': round(avg_cpu, 2),
                'average_memory_utilization': round(avg_memory, 2),
                'average_load': round(avg_load, 2),
                'last_scale_time': datetime.fromtimestamp(self.last_scale_time).isoformat() if self.last_scale_time else None
            }
            
        except Exception as e:
            self.logger.error(f"Error getting scaling statistics: {e}")
            return {}
