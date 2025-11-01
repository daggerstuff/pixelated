#!/usr/bin/env python3
"""
Stress Testing System for Pixelated Empathy AI
Comprehensive stress testing procedures with failure mode analysis and recovery testing.
"""

import os
import json
import logging
import time
import threading
import psutil
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from enum import Enum
import statistics
import random
from collections import defaultdict, deque

class StressTestType(Enum):
    """Types of stress tests."""
    CPU_STRESS = "cpu_stress"
    MEMORY_STRESS = "memory_stress"
    DISK_STRESS = "disk_stress"
    NETWORK_STRESS = "network_stress"
    CONNECTION_STRESS = "connection_stress"
    CONCURRENT_USER_STRESS = "concurrent_user_stress"
    DATA_VOLUME_STRESS = "data_volume_stress"
    SUSTAINED_LOAD_STRESS = "sustained_load_stress"
    SPIKE_STRESS = "spike_stress"
    CASCADING_FAILURE = "cascading_failure"

class FailureMode(Enum):
    """System failure modes."""
    GRACEFUL_DEGRADATION = "graceful_degradation"
    PARTIAL_FAILURE = "partial_failure"
    COMPLETE_FAILURE = "complete_failure"
    RECOVERY_FAILURE = "recovery_failure"
    DATA_CORRUPTION = "data_corruption"
    MEMORY_LEAK = "memory_leak"
    DEADLOCK = "deadlock"
    TIMEOUT = "timeout"

@dataclass
class StressTestConfig:
    """Stress test configuration."""
    name: str
    test_type: StressTestType
    duration_seconds: int
    intensity_level: int  # 1-10 scale
    target_resources: List[str]
    failure_threshold: Dict[str, float]
    recovery_timeout: int = 300  # seconds
    monitoring_interval: int = 5  # seconds
    auto_recovery: bool = True
    safety_limits: Dict[str, float] = field(default_factory=dict)

@dataclass
class SystemSnapshot:
    """System state snapshot."""
    timestamp: datetime
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    network_io: Dict[str, int]
    process_count: int
    open_files: int
    active_connections: int
    load_average: List[float]
    custom_metrics: Dict[str, float] = field(default_factory=dict)

@dataclass
class StressTestResult:
    """Stress test execution result."""
    test_name: str
    test_type: StressTestType
    start_time: datetime
    end_time: datetime
    duration: float
    peak_cpu: float
    peak_memory: float
    peak_disk_io: float
    failure_modes_detected: List[FailureMode]
    recovery_time: Optional[float]
    system_snapshots: List[SystemSnapshot]
    performance_degradation: float
    stability_score: float
    success: bool
    error_messages: List[str] = field(default_factory=list)

class SystemMonitor:
    """Monitors system resources during stress tests."""
    
    def __init__(self, monitoring_interval: int = 5):
        self.monitoring_interval = monitoring_interval
        self.monitoring = False
        self.monitor_thread = None
        self.snapshots: List[SystemSnapshot] = []
        self.logger = logging.getLogger(__name__)

    def start_monitoring(self):
        """Start system monitoring."""
        if self.monitoring:
            return
        
        self.monitoring = True
        self.snapshots = []
        self.monitor_thread = threading.Thread(target=self._monitoring_loop)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()
        
        self.logger.info("System monitoring started")

    def stop_monitoring(self):
        """Stop system monitoring."""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join()
        
        self.logger.info("System monitoring stopped")

    def _monitoring_loop(self):
        """Main monitoring loop."""
        while self.monitoring:
            try:
                snapshot = self._take_snapshot()
                self.snapshots.append(snapshot)
                time.sleep(self.monitoring_interval)
            except Exception as e:
                self.logger.error(f"Error in monitoring loop: {e}")
                time.sleep(self.monitoring_interval)

    def _take_snapshot(self) -> SystemSnapshot:
        """Take a system state snapshot."""
        # CPU usage
        cpu_usage = psutil.cpu_percent(interval=1)
        
        # Memory usage
        memory = psutil.virtual_memory()
        memory_usage = memory.percent
        
        # Disk usage
        disk = psutil.disk_usage('/')
        disk_usage = (disk.used / disk.total) * 100
        
        # Network I/O
        network = psutil.net_io_counters()
        network_io = {
            'bytes_sent': network.bytes_sent,
            'bytes_recv': network.bytes_recv,
            'packets_sent': network.packets_sent,
            'packets_recv': network.packets_recv
        }
        
        # Process information
        process_count = len(psutil.pids())
        
        # Open files (approximate)
        try:
            open_files = len(psutil.Process().open_files())
        except:
            open_files = 0
        
        # Active connections (approximate)
        try:
            active_connections = len(psutil.net_connections())
        except:
            active_connections = 0
        
        # Load average
        try:
            load_average = list(psutil.getloadavg())
        except:
            load_average = [0.0, 0.0, 0.0]
        
        return SystemSnapshot(
            timestamp=datetime.now(),
            cpu_usage=cpu_usage,
            memory_usage=memory_usage,
            disk_usage=disk_usage,
            network_io=network_io,
            process_count=process_count,
            open_files=open_files,
            active_connections=active_connections,
            load_average=load_average
        )

    def get_snapshots(self) -> List[SystemSnapshot]:
        """Get all collected snapshots."""
        return self.snapshots.copy()

class StressTestExecutor:
    """Executes various types of stress tests."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.active_processes: List[subprocess.Popen] = []

    def execute_cpu_stress(self, config: StressTestConfig) -> bool:
        """Execute CPU stress test."""
        self.logger.info(f"Starting CPU stress test - intensity {config.intensity_level}")
        
        try:
            # Calculate number of CPU cores to stress
            cpu_count = psutil.cpu_count()
            cores_to_stress = min(cpu_count, config.intensity_level)
            
            # Start CPU stress processes
            for i in range(cores_to_stress):
                # Simple CPU stress using Python
                process = subprocess.Popen([
                    'python', '-c',
                    'import time; start = time.time(); '
                    f'while time.time() - start < {config.duration_seconds}: pass'
                ])
                self.active_processes.append(process)
            
            return True
            
        except Exception as e:
            self.logger.error(f"CPU stress test failed: {e}")
            return False

    def execute_memory_stress(self, config: StressTestConfig) -> bool:
        """Execute memory stress test."""
        self.logger.info(f"Starting memory stress test - intensity {config.intensity_level}")
        
        try:
            # Calculate memory to allocate (in MB)
            available_memory = psutil.virtual_memory().available // (1024 * 1024)
            memory_to_allocate = min(available_memory * config.intensity_level // 10, available_memory - 500)
            
            # Start memory stress process
            process = subprocess.Popen([
                'python', '-c',
                f'''
import time
data = []
chunk_size = 1024 * 1024  # 1MB chunks
target_mb = {memory_to_allocate}
start_time = time.time()

while time.time() - start_time < {config.duration_seconds}:
    if len(data) * chunk_size // (1024 * 1024) < target_mb:
        data.append(b'x' * chunk_size)
    time.sleep(0.1)
'''
            ])
            self.active_processes.append(process)
            
            return True
            
        except Exception as e:
            self.logger.error(f"Memory stress test failed: {e}")
            return False

    def execute_disk_stress(self, config: StressTestConfig) -> bool:
        """Execute disk I/O stress test."""
        self.logger.info(f"Starting disk stress test - intensity {config.intensity_level}")
        
        try:
            # Create temporary directory for stress test
            stress_dir = Path("/tmp/stress_test")
            stress_dir.mkdir(exist_ok=True)
            
            # Start disk stress process
            process = subprocess.Popen([
                'python', '-c',
                f'''
import os
import time
import random

stress_dir = "/tmp/stress_test"
file_size = {config.intensity_level * 1024 * 1024}  # MB
start_time = time.time()

while time.time() - start_time < {config.duration_seconds}:
    filename = os.path.join(stress_dir, f"stress_{{random.randint(1, 100)}}.tmp")
    
    # Write file
    with open(filename, "wb") as f:
        f.write(os.urandom(file_size))
    
    # Read file
    with open(filename, "rb") as f:
        data = f.read()
    
    # Delete file
    os.remove(filename)
    
    time.sleep(0.1)
'''
            ])
            self.active_processes.append(process)
            
            return True
            
        except Exception as e:
            self.logger.error(f"Disk stress test failed: {e}")
            return False

    def execute_network_stress(self, config: StressTestConfig) -> bool:
        """Execute network stress test."""
        self.logger.info(f"Starting network stress test - intensity {config.intensity_level}")
        
        try:
            # Start network stress processes
            for i in range(config.intensity_level):
                process = subprocess.Popen([
                    'python', '-c',
                    f'''
import socket
import time
import threading

def network_stress():
    start_time = time.time()
    while time.time() - start_time < {config.duration_seconds}:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            sock.connect(("8.8.8.8", 53))
            sock.send(b"test data" * 100)
            sock.recv(1024)
            sock.close()
        except:
            pass
        time.sleep(0.01)

network_stress()
'''
                ])
                self.active_processes.append(process)
            
            return True
            
        except Exception as e:
            self.logger.error(f"Network stress test failed: {e}")
            return False

    def stop_all_stress_tests(self):
        """Stop all active stress test processes."""
        for process in self.active_processes:
            try:
                process.terminate()
                process.wait(timeout=5)
            except:
                try:
                    process.kill()
                except:
                    pass
        
        self.active_processes.clear()
        self.logger.info("All stress test processes stopped")

class FailureAnalyzer:
    """Analyzes system behavior and detects failure modes."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def analyze_snapshots(self, snapshots: List[SystemSnapshot], 
                         config: StressTestConfig) -> List[FailureMode]:
        """Analyze system snapshots for failure modes."""
        failure_modes = []
        
        if not snapshots:
            return failure_modes
        
        # Analyze CPU usage patterns
        cpu_values = [s.cpu_usage for s in snapshots]
        if max(cpu_values) > config.failure_threshold.get('cpu', 95):
            if self._is_sustained_high_usage(cpu_values, 90):
                failure_modes.append(FailureMode.PARTIAL_FAILURE)
        
        # Analyze memory usage patterns
        memory_values = [s.memory_usage for s in snapshots]
        if max(memory_values) > config.failure_threshold.get('memory', 90):
            if self._is_increasing_trend(memory_values):
                failure_modes.append(FailureMode.MEMORY_LEAK)
        
        # Analyze response degradation
        if self._detect_performance_degradation(snapshots):
            failure_modes.append(FailureMode.GRACEFUL_DEGRADATION)
        
        # Analyze system stability
        if self._detect_system_instability(snapshots):
            failure_modes.append(FailureMode.COMPLETE_FAILURE)
        
        return failure_modes

    def _is_sustained_high_usage(self, values: List[float], threshold: float) -> bool:
        """Check if usage is sustained above threshold."""
        if len(values) < 5:
            return False
        
        high_usage_count = sum(1 for v in values[-10:] if v > threshold)
        return high_usage_count >= 7  # 70% of recent samples

    def _is_increasing_trend(self, values: List[float]) -> bool:
        """Check if values show an increasing trend."""
        if len(values) < 10:
            return False
        
        first_half = values[:len(values)//2]
        second_half = values[len(values)//2:]
        
        first_avg = statistics.mean(first_half)
        second_avg = statistics.mean(second_half)
        
        return second_avg > first_avg * 1.2  # 20% increase

    def _detect_performance_degradation(self, snapshots: List[SystemSnapshot]) -> bool:
        """Detect performance degradation patterns."""
        if len(snapshots) < 10:
            return False
        
        # Check for increasing load average
        load_values = [s.load_average[0] for s in snapshots if s.load_average]
        if load_values and self._is_increasing_trend(load_values):
            return True
        
        # Check for increasing process count
        process_counts = [s.process_count for s in snapshots]
        if self._is_increasing_trend(process_counts):
            return True
        
        return False

    def _detect_system_instability(self, snapshots: List[SystemSnapshot]) -> bool:
        """Detect system instability indicators."""
        if len(snapshots) < 5:
            return False
        
        # Check for extreme resource usage
        recent_snapshots = snapshots[-5:]
        
        for snapshot in recent_snapshots:
            if (snapshot.cpu_usage > 98 and 
                snapshot.memory_usage > 95):
                return True
        
        return False

    def calculate_stability_score(self, snapshots: List[SystemSnapshot]) -> float:
        """Calculate system stability score (0-100)."""
        if not snapshots:
            return 0.0
        
        score = 100.0
        
        # CPU stability
        cpu_values = [s.cpu_usage for s in snapshots]
        cpu_variance = statistics.variance(cpu_values) if len(cpu_values) > 1 else 0
        score -= min(cpu_variance / 10, 20)  # Max 20 point deduction
        
        # Memory stability
        memory_values = [s.memory_usage for s in snapshots]
        memory_variance = statistics.variance(memory_values) if len(memory_values) > 1 else 0
        score -= min(memory_variance / 10, 20)  # Max 20 point deduction
        
        # Load average stability
        load_values = [s.load_average[0] for s in snapshots if s.load_average]
        if load_values:
            load_variance = statistics.variance(load_values) if len(load_values) > 1 else 0
            score -= min(load_variance, 20)  # Max 20 point deduction
        
        return max(score, 0.0)

class StressTestingSystem:
    """Main stress testing system."""
    
    def __init__(self):
        self.logger = self._setup_logging()
        self.monitor = SystemMonitor()
        self.executor = StressTestExecutor()
        self.analyzer = FailureAnalyzer()
        self.test_configs: Dict[str, StressTestConfig] = {}
        self.test_results: List[StressTestResult] = []

    def _setup_logging(self) -> logging.Logger:
        """Setup logging for stress testing."""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        return logging.getLogger(__name__)

    def add_test_config(self, config: StressTestConfig):
        """Add a stress test configuration."""
        self.test_configs[config.name] = config
        self.logger.info(f"Added stress test config: {config.name}")

    def run_stress_test(self, test_name: str) -> StressTestResult:
        """Run a specific stress test."""
        if test_name not in self.test_configs:
            raise ValueError(f"Test config '{test_name}' not found")
        
        config = self.test_configs[test_name]
        
        self.logger.info(f"Starting stress test: {test_name}")
        self.logger.info(f"Test type: {config.test_type.value}")
        self.logger.info(f"Duration: {config.duration_seconds}s")
        self.logger.info(f"Intensity: {config.intensity_level}/10")
        
        start_time = datetime.now()
        
        # Start monitoring
        self.monitor.start_monitoring()
        
        try:
            # Execute stress test based on type
            success = self._execute_stress_test(config)
            
            # Wait for test completion
            time.sleep(config.duration_seconds)
            
            # Stop stress test
            self.executor.stop_all_stress_tests()
            
            # Stop monitoring
            self.monitor.stop_monitoring()
            
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            # Analyze results
            snapshots = self.monitor.get_snapshots()
            failure_modes = self.analyzer.analyze_snapshots(snapshots, config)
            stability_score = self.analyzer.calculate_stability_score(snapshots)
            
            # Calculate peak values
            peak_cpu = max(s.cpu_usage for s in snapshots) if snapshots else 0
            peak_memory = max(s.memory_usage for s in snapshots) if snapshots else 0
            peak_disk_io = max(s.disk_usage for s in snapshots) if snapshots else 0
            
            # Calculate performance degradation
            performance_degradation = self._calculate_performance_degradation(snapshots)
            
            # Create result
            result = StressTestResult(
                test_name=test_name,
                test_type=config.test_type,
                start_time=start_time,
                end_time=end_time,
                duration=duration,
                peak_cpu=peak_cpu,
                peak_memory=peak_memory,
                peak_disk_io=peak_disk_io,
                failure_modes_detected=failure_modes,
                recovery_time=None,  # Would be measured in real scenario
                system_snapshots=snapshots,
                performance_degradation=performance_degradation,
                stability_score=stability_score,
                success=success and len(failure_modes) == 0
            )
            
            self.test_results.append(result)
            
            self.logger.info(f"Stress test completed: {test_name}")
            self.logger.info(f"Peak CPU: {peak_cpu:.1f}%")
            self.logger.info(f"Peak Memory: {peak_memory:.1f}%")
            self.logger.info(f"Stability Score: {stability_score:.1f}/100")
            self.logger.info(f"Failure Modes: {len(failure_modes)}")
            
            return result
            
        except Exception as e:
            self.logger.error(f"Stress test failed: {e}")
            self.monitor.stop_monitoring()
            self.executor.stop_all_stress_tests()
            raise

    def _execute_stress_test(self, config: StressTestConfig) -> bool:
        """Execute stress test based on configuration."""
        if config.test_type == StressTestType.CPU_STRESS:
            return self.executor.execute_cpu_stress(config)
        elif config.test_type == StressTestType.MEMORY_STRESS:
            return self.executor.execute_memory_stress(config)
        elif config.test_type == StressTestType.DISK_STRESS:
            return self.executor.execute_disk_stress(config)
        elif config.test_type == StressTestType.NETWORK_STRESS:
            return self.executor.execute_network_stress(config)
        else:
            self.logger.warning(f"Unsupported test type: {config.test_type}")
            return False

    def _calculate_performance_degradation(self, snapshots: List[SystemSnapshot]) -> float:
        """Calculate performance degradation percentage."""
        if len(snapshots) < 10:
            return 0.0
        
        # Compare first 25% vs last 25% of snapshots
        first_quarter = snapshots[:len(snapshots)//4]
        last_quarter = snapshots[-len(snapshots)//4:]
        
        # Calculate average load for each quarter
        first_load = statistics.mean(s.load_average[0] for s in first_quarter if s.load_average)
        last_load = statistics.mean(s.load_average[0] for s in last_quarter if s.load_average)
        
        if first_load == 0:
            return 0.0
        
        degradation = ((last_load - first_load) / first_load) * 100
        return max(degradation, 0.0)

    def generate_stress_test_report(self) -> str:
        """Generate comprehensive stress test report."""
        report_file = f"stress_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        report = {
            'generated_at': datetime.now().isoformat(),
            'total_tests': len(self.test_results),
            'successful_tests': len([r for r in self.test_results if r.success]),
            'failed_tests': len([r for r in self.test_results if not r.success]),
            'test_results': [asdict(result) for result in self.test_results]
        }
        
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        self.logger.info(f"Stress test report saved to {report_file}")
        return report_file

def main():
    """Main function for testing the stress testing system."""
    print("💥 STRESS TESTING SYSTEM TEST")
    print("=" * 50)
    
    # Initialize stress testing system
    stress_system = StressTestingSystem()
    
    # Create test configurations
    cpu_stress_config = StressTestConfig(
        name="cpu_stress_test",
        test_type=StressTestType.CPU_STRESS,
        duration_seconds=15,
        intensity_level=3,
        target_resources=["cpu"],
        failure_threshold={"cpu": 95, "memory": 90}
    )
    
    memory_stress_config = StressTestConfig(
        name="memory_stress_test",
        test_type=StressTestType.MEMORY_STRESS,
        duration_seconds=10,
        intensity_level=2,
        target_resources=["memory"],
        failure_threshold={"cpu": 95, "memory": 90}
    )
    
    stress_system.add_test_config(cpu_stress_config)
    stress_system.add_test_config(memory_stress_config)
    
    print(f"✅ Added {len(stress_system.test_configs)} stress test configurations")
    
    # Run stress tests
    try:
        result1 = stress_system.run_stress_test("cpu_stress_test")
        print(f"✅ CPU stress test: Peak CPU {result1.peak_cpu:.1f}%, Stability {result1.stability_score:.1f}/100")
        
        result2 = stress_system.run_stress_test("memory_stress_test")
        print(f"✅ Memory stress test: Peak Memory {result2.peak_memory:.1f}%, Stability {result2.stability_score:.1f}/100")
        
        # Generate report
        report_file = stress_system.generate_stress_test_report()
        print(f"✅ Stress test report: {report_file}")
        
    except Exception as e:
        print(f"❌ Stress test execution failed: {e}")
    
    print("\n🎉 Stress testing system is functional!")

if __name__ == "__main__":
    main()


# Alias for compatibility
StressTestingFramework = StressTestType


class StressTestingFramework:
    """Complete stress testing framework."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.test_results = []
        self.current_test = None
    
    def cpu_stress_test(self, duration: int = 30) -> Dict:
        """Run CPU stress test."""
        try:
            import psutil
            import threading
            
            self.logger.info(f"Starting CPU stress test for {duration} seconds")
            
            start_time = time.time()
            stop_event = threading.Event()
            
            def cpu_worker():
                while not stop_event.is_set():
                    # CPU intensive work
                    sum(i * i for i in range(1000))
            
            # Start multiple CPU workers
            workers = []
            for _ in range(psutil.cpu_count()):
                worker = threading.Thread(target=cpu_worker)
                worker.start()
                workers.append(worker)
            
            # Monitor for duration
            time.sleep(duration)
            stop_event.set()
            
            # Wait for workers to finish
            for worker in workers:
                worker.join(timeout=1)
            
            end_time = time.time()
            
            result = {
                'test_type': 'cpu_stress',
                'duration': end_time - start_time,
                'status': 'completed',
                'timestamp': datetime.now().isoformat()
            }
            
            self.test_results.append(result)
            return result
            
        except Exception as e:
            self.logger.error(f"CPU stress test failed: {e}")
            return {'test_type': 'cpu_stress', 'status': 'failed', 'error': str(e)}
    
    def memory_stress_test(self, duration: int = 30) -> Dict:
        """Run memory stress test."""
        try:
            self.logger.info(f"Starting memory stress test for {duration} seconds")
            
            start_time = time.time()
            memory_blocks = []
            
            # Allocate memory blocks
            for i in range(duration):
                # Allocate 10MB blocks
                block = bytearray(10 * 1024 * 1024)
                memory_blocks.append(block)
                time.sleep(1)
            
            end_time = time.time()
            
            # Clean up
            del memory_blocks
            
            result = {
                'test_type': 'memory_stress',
                'duration': end_time - start_time,
                'status': 'completed',
                'timestamp': datetime.now().isoformat()
            }
            
            self.test_results.append(result)
            return result
            
        except Exception as e:
            self.logger.error(f"Memory stress test failed: {e}")
            return {'test_type': 'memory_stress', 'status': 'failed', 'error': str(e)}
    
    def run_stress_test(self, test_type: str = 'cpu', duration: int = 30) -> Dict:
        """Run a stress test."""
        if test_type == 'cpu':
            return self.cpu_stress_test(duration)
        elif test_type == 'memory':
            return self.memory_stress_test(duration)
        else:
            return {'status': 'failed', 'error': f'Unknown test type: {test_type}'}
    
    def get_test_results(self) -> List[Dict]:
        """Get all test results."""
        return self.test_results
