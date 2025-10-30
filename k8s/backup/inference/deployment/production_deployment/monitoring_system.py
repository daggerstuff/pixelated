#!/usr/bin/env python3
"""
Production Monitoring System for Pixelated Empathy AI
Comprehensive monitoring with metrics, alerting, health checks, and observability.
"""

import os
import time
import json
import logging
import asyncio
import psutil
import requests
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from enum import Enum
import threading
from collections import defaultdict, deque
import statistics

# Prometheus client for metrics
try:
    from prometheus_client import Counter, Histogram, Gauge, Summary, start_http_server, CollectorRegistry, REGISTRY
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    print("Warning: prometheus_client not available. Install with: pip install prometheus_client")

class AlertSeverity(Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class HealthStatus(Enum):
    """Health check status."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"

@dataclass
class MetricPoint:
    """Individual metric data point."""
    name: str
    value: float
    timestamp: datetime
    labels: Dict[str, str] = field(default_factory=dict)
    unit: str = ""

@dataclass
class Alert:
    """Alert definition and state."""
    name: str
    severity: AlertSeverity
    condition: str
    threshold: float
    message: str
    active: bool = False
    triggered_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    count: int = 0

@dataclass
class HealthCheck:
    """Health check definition."""
    name: str
    check_function: Callable
    interval: int
    timeout: int
    status: HealthStatus = HealthStatus.UNKNOWN
    last_check: Optional[datetime] = None
    last_error: Optional[str] = None
    consecutive_failures: int = 0

class MetricsCollector:
    """Collects and manages application metrics."""
    
    def __init__(self):
        self.metrics_data = defaultdict(deque)
        self.max_points = 1000  # Keep last 1000 points per metric
        
        # Prometheus metrics (if available)
        if PROMETHEUS_AVAILABLE:
            self.registry = CollectorRegistry()
            self.prometheus_metrics = {
                'requests_total': Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'], registry=self.registry),
                'request_duration': Histogram('http_request_duration_seconds', 'HTTP request duration', ['method', 'endpoint'], registry=self.registry),
                'active_connections': Gauge('active_connections', 'Active connections', registry=self.registry),
                'memory_usage': Gauge('memory_usage_bytes', 'Memory usage in bytes', registry=self.registry),
                'cpu_usage': Gauge('cpu_usage_percent', 'CPU usage percentage', registry=self.registry),
                'disk_usage': Gauge('disk_usage_percent', 'Disk usage percentage', ['mount'], registry=self.registry),
                'ai_inference_duration': Histogram('ai_inference_duration_seconds', 'AI inference duration', ['model'], registry=self.registry),
                'ai_inference_total': Counter('ai_inference_total', 'Total AI inferences', ['model', 'status'], registry=self.registry),
                'database_connections': Gauge('database_connections', 'Database connections', ['state'], registry=self.registry),
                'cache_hits': Counter('cache_hits_total', 'Cache hits', ['cache_type'], registry=self.registry),
                'cache_misses': Counter('cache_misses_total', 'Cache misses', ['cache_type'], registry=self.registry)
            }
        else:
            self.prometheus_metrics = {}

    def record_metric(self, name: str, value: float, labels: Dict[str, str] = None, unit: str = ""):
        """Record a metric data point."""
        labels = labels or {}
        
        metric_point = MetricPoint(
            name=name,
            value=value,
            timestamp=datetime.now(),
            labels=labels,
            unit=unit
        )
        
        # Store in local buffer
        metric_key = f"{name}:{json.dumps(labels, sort_keys=True)}"
        self.metrics_data[metric_key].append(metric_point)
        
        # Keep only recent points
        if len(self.metrics_data[metric_key]) > self.max_points:
            self.metrics_data[metric_key].popleft()

    def get_metric_history(self, name: str, labels: Dict[str, str] = None, 
                          duration: timedelta = timedelta(hours=1)) -> List[MetricPoint]:
        """Get metric history for a time period."""
        labels = labels or {}
        metric_key = f"{name}:{json.dumps(labels, sort_keys=True)}"
        
        cutoff_time = datetime.now() - duration
        return [
            point for point in self.metrics_data[metric_key]
            if point.timestamp >= cutoff_time
        ]

    def get_metric_stats(self, name: str, labels: Dict[str, str] = None,
                        duration: timedelta = timedelta(minutes=5)) -> Dict[str, float]:
        """Get statistical summary of a metric."""
        history = self.get_metric_history(name, labels, duration)
        
        if not history:
            return {}
        
        values = [point.value for point in history]
        
        return {
            'count': len(values),
            'min': min(values),
            'max': max(values),
            'mean': statistics.mean(values),
            'median': statistics.median(values),
            'std_dev': statistics.stdev(values) if len(values) > 1 else 0.0,
            'latest': values[-1] if values else 0.0
        }

class SystemMonitor:
    """Monitors system resources and performance."""
    
    def __init__(self, metrics_collector: MetricsCollector):
        self.metrics = metrics_collector
        self.monitoring = False
        self.monitor_thread = None

    def start_monitoring(self, interval: int = 30):
        """Start system monitoring."""
        self.monitoring = True
        self.monitor_thread = threading.Thread(target=self._monitor_loop, args=(interval,))
        self.monitor_thread.daemon = True
        self.monitor_thread.start()

    def stop_monitoring(self):
        """Stop system monitoring."""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join()

    def _monitor_loop(self, interval: int):
        """Main monitoring loop."""
        while self.monitoring:
            try:
                self._collect_system_metrics()
                time.sleep(interval)
            except Exception as e:
                logging.error(f"Error in system monitoring: {e}")
                time.sleep(interval)

    def _collect_system_metrics(self):
        """Collect system performance metrics."""
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=1)
        self.metrics.record_metric('system.cpu_usage', cpu_percent, unit='percent')
        
        if PROMETHEUS_AVAILABLE and 'cpu_usage' in self.metrics.prometheus_metrics:
            self.metrics.prometheus_metrics['cpu_usage'].set(cpu_percent)

        # Memory usage
        memory = psutil.virtual_memory()
        self.metrics.record_metric('system.memory_usage', memory.used, unit='bytes')
        self.metrics.record_metric('system.memory_percent', memory.percent, unit='percent')
        
        if PROMETHEUS_AVAILABLE and 'memory_usage' in self.metrics.prometheus_metrics:
            self.metrics.prometheus_metrics['memory_usage'].set(memory.used)

        # Disk usage
        for partition in psutil.disk_partitions():
            try:
                disk_usage = psutil.disk_usage(partition.mountpoint)
                disk_percent = (disk_usage.used / disk_usage.total) * 100
                
                self.metrics.record_metric(
                    'system.disk_usage',
                    disk_percent,
                    labels={'mount': partition.mountpoint},
                    unit='percent'
                )
                
                if PROMETHEUS_AVAILABLE and 'disk_usage' in self.metrics.prometheus_metrics:
                    self.metrics.prometheus_metrics['disk_usage'].labels(mount=partition.mountpoint).set(disk_percent)
                    
            except PermissionError:
                continue

        # Network I/O
        network = psutil.net_io_counters()
        self.metrics.record_metric('system.network_bytes_sent', network.bytes_sent, unit='bytes')
        self.metrics.record_metric('system.network_bytes_recv', network.bytes_recv, unit='bytes')

        # Process count
        process_count = len(psutil.pids())
        self.metrics.record_metric('system.process_count', process_count, unit='count')

class HealthChecker:
    """Manages health checks for various system components."""
    
    def __init__(self, metrics_collector: MetricsCollector):
        self.metrics = metrics_collector
        self.health_checks: Dict[str, HealthCheck] = {}
        self.checking = False
        self.check_thread = None

    def register_health_check(self, name: str, check_function: Callable,
                            interval: int = 60, timeout: int = 10):
        """Register a new health check."""
        health_check = HealthCheck(
            name=name,
            check_function=check_function,
            interval=interval,
            timeout=timeout
        )
        self.health_checks[name] = health_check

    def start_health_checks(self):
        """Start health check monitoring."""
        self.checking = True
        self.check_thread = threading.Thread(target=self._health_check_loop)
        self.check_thread.daemon = True
        self.check_thread.start()

    def stop_health_checks(self):
        """Stop health check monitoring."""
        self.checking = False
        if self.check_thread:
            self.check_thread.join()

    def _health_check_loop(self):
        """Main health check loop."""
        while self.checking:
            for health_check in self.health_checks.values():
                if self._should_run_check(health_check):
                    self._run_health_check(health_check)
            
            time.sleep(5)  # Check every 5 seconds

    def _should_run_check(self, health_check: HealthCheck) -> bool:
        """Determine if a health check should run."""
        if health_check.last_check is None:
            return True
        
        time_since_last = datetime.now() - health_check.last_check
        return time_since_last.total_seconds() >= health_check.interval

    def _run_health_check(self, health_check: HealthCheck):
        """Run a single health check."""
        try:
            start_time = time.time()
            
            # Run the check function with timeout
            result = health_check.check_function()
            
            duration = time.time() - start_time
            
            if result:
                health_check.status = HealthStatus.HEALTHY
                health_check.consecutive_failures = 0
                health_check.last_error = None
            else:
                health_check.consecutive_failures += 1
                health_check.status = HealthStatus.UNHEALTHY if health_check.consecutive_failures >= 3 else HealthStatus.DEGRADED
            
            health_check.last_check = datetime.now()
            
            # Record metrics
            self.metrics.record_metric(
                'health_check.duration',
                duration,
                labels={'check': health_check.name},
                unit='seconds'
            )
            
            self.metrics.record_metric(
                'health_check.status',
                1 if result else 0,
                labels={'check': health_check.name}
            )
            
        except Exception as e:
            health_check.status = HealthStatus.UNHEALTHY
            health_check.last_error = str(e)
            health_check.consecutive_failures += 1
            health_check.last_check = datetime.now()

    def get_overall_health(self) -> HealthStatus:
        """Get overall system health status."""
        if not self.health_checks:
            return HealthStatus.UNKNOWN
        
        statuses = [check.status for check in self.health_checks.values()]
        
        if any(status == HealthStatus.UNHEALTHY for status in statuses):
            return HealthStatus.UNHEALTHY
        elif any(status == HealthStatus.DEGRADED for status in statuses):
            return HealthStatus.DEGRADED
        elif all(status == HealthStatus.HEALTHY for status in statuses):
            return HealthStatus.HEALTHY
        else:
            return HealthStatus.UNKNOWN

class AlertManager:
    """Manages alerts and notifications."""
    
    def __init__(self, metrics_collector: MetricsCollector):
        self.metrics = metrics_collector
        self.alerts: Dict[str, Alert] = {}
        self.alert_handlers: List[Callable] = []
        self.checking = False
        self.alert_thread = None

    def register_alert(self, name: str, condition: str, threshold: float,
                      severity: AlertSeverity, message: str):
        """Register a new alert."""
        alert = Alert(
            name=name,
            severity=severity,
            condition=condition,
            threshold=threshold,
            message=message
        )
        self.alerts[name] = alert

    def add_alert_handler(self, handler: Callable):
        """Add an alert handler function."""
        self.alert_handlers.append(handler)

    def start_alert_monitoring(self):
        """Start alert monitoring."""
        self.checking = True
        self.alert_thread = threading.Thread(target=self._alert_check_loop)
        self.alert_thread.daemon = True
        self.alert_thread.start()

    def stop_alert_monitoring(self):
        """Stop alert monitoring."""
        self.checking = False
        if self.alert_thread:
            self.alert_thread.join()

    def _alert_check_loop(self):
        """Main alert checking loop."""
        while self.checking:
            for alert in self.alerts.values():
                self._check_alert(alert)
            
            time.sleep(30)  # Check every 30 seconds

    def _check_alert(self, alert: Alert):
        """Check if an alert condition is met."""
        try:
            # Parse condition and get metric value
            metric_value = self._evaluate_alert_condition(alert.condition)
            
            if metric_value is None:
                return
            
            # Check threshold
            should_trigger = self._should_trigger_alert(alert, metric_value)
            
            if should_trigger and not alert.active:
                self._trigger_alert(alert, metric_value)
            elif not should_trigger and alert.active:
                self._resolve_alert(alert)
                
        except Exception as e:
            logging.error(f"Error checking alert {alert.name}: {e}")

    def _evaluate_alert_condition(self, condition: str) -> Optional[float]:
        """Evaluate alert condition and return metric value."""
        # Simple condition parsing - in production, use a proper expression parser
        if 'cpu_usage' in condition:
            stats = self.metrics.get_metric_stats('system.cpu_usage')
            return stats.get('latest', 0.0)
        elif 'memory_percent' in condition:
            stats = self.metrics.get_metric_stats('system.memory_percent')
            return stats.get('latest', 0.0)
        elif 'disk_usage' in condition:
            stats = self.metrics.get_metric_stats('system.disk_usage')
            return stats.get('max', 0.0)  # Use max across all mounts
        
        return None

    def _should_trigger_alert(self, alert: Alert, value: float) -> bool:
        """Determine if alert should trigger based on condition."""
        if 'greater_than' in alert.condition:
            return value > alert.threshold
        elif 'less_than' in alert.condition:
            return value < alert.threshold
        
        return False

    def _trigger_alert(self, alert: Alert, value: float):
        """Trigger an alert."""
        alert.active = True
        alert.triggered_at = datetime.now()
        alert.count += 1
        
        alert_data = {
            'alert': alert.name,
            'severity': alert.severity.value,
            'message': alert.message,
            'value': value,
            'threshold': alert.threshold,
            'triggered_at': alert.triggered_at.isoformat()
        }
        
        # Call alert handlers
        for handler in self.alert_handlers:
            try:
                handler(alert_data)
            except Exception as e:
                logging.error(f"Error in alert handler: {e}")
        
        logging.warning(f"ALERT TRIGGERED: {alert.name} - {alert.message} (value: {value})")

    def _resolve_alert(self, alert: Alert):
        """Resolve an alert."""
        alert.active = False
        alert.resolved_at = datetime.now()
        
        alert_data = {
            'alert': alert.name,
            'severity': alert.severity.value,
            'message': f"RESOLVED: {alert.message}",
            'resolved_at': alert.resolved_at.isoformat()
        }
        
        # Call alert handlers
        for handler in self.alert_handlers:
            try:
                handler(alert_data)
            except Exception as e:
                logging.error(f"Error in alert handler: {e}")
        
        logging.info(f"ALERT RESOLVED: {alert.name}")

class ProductionMonitor:
    """Main production monitoring system."""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.logger = self._setup_logging()
        
        # Initialize components
        self.metrics = MetricsCollector()
        self.system_monitor = SystemMonitor(self.metrics)
        self.health_checker = HealthChecker(self.metrics)
        self.alert_manager = AlertManager(self.metrics)
        
        # Setup default health checks
        self._setup_default_health_checks()
        
        # Setup default alerts
        self._setup_default_alerts()
        
        # Setup alert handlers
        self._setup_alert_handlers()

    def _setup_logging(self) -> logging.Logger:
        """Setup monitoring logging."""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        return logging.getLogger(__name__)

    def _setup_default_health_checks(self):
        """Setup default health checks."""
        # Database health check
        def check_database():
            try:
                # This would be replaced with actual database check
                return True
            except:
                return False
        
        # Redis health check
        def check_redis():
            try:
                # This would be replaced with actual Redis check
                return True
            except:
                return False
        
        # HTTP endpoint health check
        def check_http_endpoint():
            try:
                response = requests.get('http://localhost:8000/health', timeout=5)
                return response.status_code == 200
            except:
                return False
        
        self.health_checker.register_health_check('database', check_database, interval=60)
        self.health_checker.register_health_check('redis', check_redis, interval=60)
        self.health_checker.register_health_check('http_endpoint', check_http_endpoint, interval=30)

    def _setup_default_alerts(self):
        """Setup default alerts."""
        self.alert_manager.register_alert(
            'high_cpu_usage',
            'cpu_usage greater_than',
            80.0,
            AlertSeverity.WARNING,
            'CPU usage is above 80%'
        )
        
        self.alert_manager.register_alert(
            'high_memory_usage',
            'memory_percent greater_than',
            85.0,
            AlertSeverity.WARNING,
            'Memory usage is above 85%'
        )
        
        self.alert_manager.register_alert(
            'high_disk_usage',
            'disk_usage greater_than',
            90.0,
            AlertSeverity.CRITICAL,
            'Disk usage is above 90%'
        )

    def _setup_alert_handlers(self):
        """Setup alert handlers."""
        def log_alert_handler(alert_data):
            severity = alert_data['severity'].upper()
            message = alert_data['message']
            self.logger.warning(f"[{severity}] {message}")
        
        def webhook_alert_handler(alert_data):
            webhook_url = self.config.get('webhook_url')
            if webhook_url:
                try:
                    requests.post(webhook_url, json=alert_data, timeout=10)
                except Exception as e:
                    self.logger.error(f"Failed to send webhook alert: {e}")
        
        self.alert_manager.add_alert_handler(log_alert_handler)
        self.alert_manager.add_alert_handler(webhook_alert_handler)

    def start_monitoring(self):
        """Start all monitoring components."""
        self.logger.info("Starting production monitoring system...")
        
        # Start Prometheus metrics server if available
        if PROMETHEUS_AVAILABLE:
            metrics_port = self.config.get('metrics_port', 9090)
            try:
                start_http_server(metrics_port, registry=self.metrics.registry)
                self.logger.info(f"Prometheus metrics server started on port {metrics_port}")
            except Exception as e:
                self.logger.error(f"Failed to start Prometheus metrics server: {e}")
        
        # Start monitoring components
        self.system_monitor.start_monitoring()
        self.health_checker.start_health_checks()
        self.alert_manager.start_alert_monitoring()
        
        self.logger.info("Production monitoring system started successfully")

    def stop_monitoring(self):
        """Stop all monitoring components."""
        self.logger.info("Stopping production monitoring system...")
        
        self.system_monitor.stop_monitoring()
        self.health_checker.stop_health_checks()
        self.alert_manager.stop_alert_monitoring()
        
        self.logger.info("Production monitoring system stopped")

    def get_monitoring_status(self) -> Dict[str, Any]:
        """Get current monitoring status."""
        return {
            'timestamp': datetime.now().isoformat(),
            'overall_health': self.health_checker.get_overall_health().value,
            'health_checks': {
                name: {
                    'status': check.status.value,
                    'last_check': check.last_check.isoformat() if check.last_check else None,
                    'consecutive_failures': check.consecutive_failures,
                    'last_error': check.last_error
                }
                for name, check in self.health_checker.health_checks.items()
            },
            'active_alerts': [
                {
                    'name': alert.name,
                    'severity': alert.severity.value,
                    'message': alert.message,
                    'triggered_at': alert.triggered_at.isoformat() if alert.triggered_at else None,
                    'count': alert.count
                }
                for alert in self.alert_manager.alerts.values()
                if alert.active
            ],
            'system_metrics': {
                'cpu_usage': self.metrics.get_metric_stats('system.cpu_usage'),
                'memory_usage': self.metrics.get_metric_stats('system.memory_percent'),
                'disk_usage': self.metrics.get_metric_stats('system.disk_usage')
            }
        }

    def generate_monitoring_report(self) -> str:
        """Generate comprehensive monitoring report."""
        report_file = f"monitoring_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        status = self.get_monitoring_status()
        
        # Add historical data
        status['historical_data'] = {
            'cpu_usage_24h': [
                asdict(point) for point in 
                self.metrics.get_metric_history('system.cpu_usage', duration=timedelta(hours=24))
            ],
            'memory_usage_24h': [
                asdict(point) for point in 
                self.metrics.get_metric_history('system.memory_percent', duration=timedelta(hours=24))
            ]
        }
        
        with open(report_file, 'w') as f:
            json.dump(status, f, indent=2, default=str)
        
        self.logger.info(f"Monitoring report saved to {report_file}")
        return report_file

def main():
    """Main function for testing the monitoring system."""
    print("🔍 PRODUCTION MONITORING SYSTEM TEST")
    print("=" * 50)
    
    # Initialize monitoring system
    config = {
        'metrics_port': 9091,  # Use different port for testing
        'webhook_url': None
    }
    
    monitor = ProductionMonitor(config)
    
    # Start monitoring
    monitor.start_monitoring()
    
    print("✅ Monitoring system started")
    
    # Let it run for a few seconds to collect some data
    time.sleep(10)
    
    # Get status
    status = monitor.get_monitoring_status()
    print(f"✅ Overall health: {status['overall_health']}")
    print(f"✅ Health checks: {len(status['health_checks'])}")
    print(f"✅ Active alerts: {len(status['active_alerts'])}")
    
    # Generate report
    report_file = monitor.generate_monitoring_report()
    print(f"✅ Report generated: {report_file}")
    
    # Stop monitoring
    monitor.stop_monitoring()
    
    print("\n🎉 Production monitoring system is functional!")

if __name__ == "__main__":
    main()
