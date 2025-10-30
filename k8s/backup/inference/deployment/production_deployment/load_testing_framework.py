#!/usr/bin/env python3
"""
Load Testing Framework for Pixelated Empathy AI
Comprehensive performance and stress testing with automated scenarios.
"""

import os
import json
import logging
import time
import threading
import asyncio
import aiohttp
import requests
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from enum import Enum
import statistics
import random
import concurrent.futures
from collections import defaultdict, deque
import psutil

class TestType(Enum):
    """Types of load tests."""
    LOAD_TEST = "load_test"
    STRESS_TEST = "stress_test"
    SPIKE_TEST = "spike_test"
    VOLUME_TEST = "volume_test"
    ENDURANCE_TEST = "endurance_test"
    SCALABILITY_TEST = "scalability_test"

class TestStatus(Enum):
    """Test execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class TestScenario:
    """Load test scenario definition."""
    name: str
    test_type: TestType
    target_url: str
    concurrent_users: int
    duration_seconds: int
    ramp_up_seconds: int = 0
    ramp_down_seconds: int = 0
    request_rate: Optional[int] = None  # requests per second
    payload: Optional[Dict[str, Any]] = None
    headers: Dict[str, str] = field(default_factory=dict)
    think_time: float = 0.0  # seconds between requests
    success_criteria: Dict[str, Any] = field(default_factory=dict)

@dataclass
class TestResult:
    """Individual test request result."""
    timestamp: datetime
    response_time: float
    status_code: int
    success: bool
    error_message: str = ""
    response_size: int = 0

@dataclass
class TestReport:
    """Comprehensive test report."""
    scenario_name: str
    test_type: TestType
    start_time: datetime
    end_time: datetime
    duration: float
    total_requests: int
    successful_requests: int
    failed_requests: int
    requests_per_second: float
    average_response_time: float
    min_response_time: float
    max_response_time: float
    p50_response_time: float
    p95_response_time: float
    p99_response_time: float
    error_rate: float
    throughput_mbps: float
    concurrent_users: int
    success_criteria_met: bool
    errors: Dict[str, int] = field(default_factory=dict)
    response_time_distribution: List[float] = field(default_factory=list)

class LoadGenerator:
    """Generates load for testing."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.session = None
        self.results: List[TestResult] = []
        self.running = False

    async def run_async_test(self, scenario: TestScenario) -> List[TestResult]:
        """Run asynchronous load test."""
        self.results = []
        self.running = True
        
        connector = aiohttp.TCPConnector(limit=scenario.concurrent_users * 2)
        timeout = aiohttp.ClientTimeout(total=30)
        
        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            self.session = session
            
            # Create tasks for concurrent users
            tasks = []
            for user_id in range(scenario.concurrent_users):
                task = asyncio.create_task(
                    self._simulate_user_async(scenario, user_id)
                )
                tasks.append(task)
            
            # Wait for all tasks to complete
            await asyncio.gather(*tasks, return_exceptions=True)
        
        return self.results

    async def _simulate_user_async(self, scenario: TestScenario, user_id: int):
        """Simulate a single user's behavior asynchronously."""
        start_time = time.time()
        end_time = start_time + scenario.duration_seconds
        
        # Ramp-up delay
        if scenario.ramp_up_seconds > 0:
            delay = (user_id / scenario.concurrent_users) * scenario.ramp_up_seconds
            await asyncio.sleep(delay)
        
        while time.time() < end_time and self.running:
            try:
                await self._make_request_async(scenario)
                
                # Think time between requests
                if scenario.think_time > 0:
                    await asyncio.sleep(scenario.think_time)
                
                # Rate limiting
                if scenario.request_rate:
                    await asyncio.sleep(1.0 / scenario.request_rate)
                    
            except Exception as e:
                self.logger.error(f"Error in user simulation {user_id}: {e}")

    async def _make_request_async(self, scenario: TestScenario):
        """Make an asynchronous HTTP request."""
        start_time = time.time()
        
        try:
            method = scenario.payload and 'POST' or 'GET'
            
            if method == 'POST':
                async with self.session.post(
                    scenario.target_url,
                    json=scenario.payload,
                    headers=scenario.headers
                ) as response:
                    content = await response.read()
                    response_time = time.time() - start_time
                    
                    result = TestResult(
                        timestamp=datetime.now(),
                        response_time=response_time,
                        status_code=response.status,
                        success=200 <= response.status < 400,
                        response_size=len(content)
                    )
            else:
                async with self.session.get(
                    scenario.target_url,
                    headers=scenario.headers
                ) as response:
                    content = await response.read()
                    response_time = time.time() - start_time
                    
                    result = TestResult(
                        timestamp=datetime.now(),
                        response_time=response_time,
                        status_code=response.status,
                        success=200 <= response.status < 400,
                        response_size=len(content)
                    )
            
            self.results.append(result)
            
        except Exception as e:
            response_time = time.time() - start_time
            result = TestResult(
                timestamp=datetime.now(),
                response_time=response_time,
                status_code=0,
                success=False,
                error_message=str(e)
            )
            self.results.append(result)

    def run_sync_test(self, scenario: TestScenario) -> List[TestResult]:
        """Run synchronous load test using threading."""
        self.results = []
        self.running = True
        
        # Create thread pool
        with concurrent.futures.ThreadPoolExecutor(max_workers=scenario.concurrent_users) as executor:
            # Submit tasks for each user
            futures = []
            for user_id in range(scenario.concurrent_users):
                future = executor.submit(self._simulate_user_sync, scenario, user_id)
                futures.append(future)
            
            # Wait for completion
            concurrent.futures.wait(futures)
        
        return self.results

    def _simulate_user_sync(self, scenario: TestScenario, user_id: int):
        """Simulate a single user's behavior synchronously."""
        start_time = time.time()
        end_time = start_time + scenario.duration_seconds
        
        # Ramp-up delay
        if scenario.ramp_up_seconds > 0:
            delay = (user_id / scenario.concurrent_users) * scenario.ramp_up_seconds
            time.sleep(delay)
        
        session = requests.Session()
        
        while time.time() < end_time and self.running:
            try:
                self._make_request_sync(scenario, session)
                
                # Think time between requests
                if scenario.think_time > 0:
                    time.sleep(scenario.think_time)
                
                # Rate limiting
                if scenario.request_rate:
                    time.sleep(1.0 / scenario.request_rate)
                    
            except Exception as e:
                self.logger.error(f"Error in user simulation {user_id}: {e}")

    def _make_request_sync(self, scenario: TestScenario, session: requests.Session):
        """Make a synchronous HTTP request."""
        start_time = time.time()
        
        try:
            if scenario.payload:
                response = session.post(
                    scenario.target_url,
                    json=scenario.payload,
                    headers=scenario.headers,
                    timeout=30
                )
            else:
                response = session.get(
                    scenario.target_url,
                    headers=scenario.headers,
                    timeout=30
                )
            
            response_time = time.time() - start_time
            
            result = TestResult(
                timestamp=datetime.now(),
                response_time=response_time,
                status_code=response.status_code,
                success=200 <= response.status_code < 400,
                response_size=len(response.content)
            )
            
            self.results.append(result)
            
        except Exception as e:
            response_time = time.time() - start_time
            result = TestResult(
                timestamp=datetime.now(),
                response_time=response_time,
                status_code=0,
                success=False,
                error_message=str(e)
            )
            self.results.append(result)

    def stop_test(self):
        """Stop the running test."""
        self.running = False

class TestAnalyzer:
    """Analyzes test results and generates reports."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def analyze_results(self, scenario: TestScenario, results: List[TestResult]) -> TestReport:
        """Analyze test results and create report."""
        if not results:
            return self._create_empty_report(scenario)
        
        # Basic statistics
        total_requests = len(results)
        successful_requests = len([r for r in results if r.success])
        failed_requests = total_requests - successful_requests
        
        # Response times
        response_times = [r.response_time for r in results]
        response_times.sort()
        
        # Time analysis
        start_time = min(r.timestamp for r in results)
        end_time = max(r.timestamp for r in results)
        duration = (end_time - start_time).total_seconds()
        
        # Calculate percentiles
        def percentile(data: List[float], p: float) -> float:
            if not data:
                return 0.0
            index = int(len(data) * p / 100)
            return data[min(index, len(data) - 1)]
        
        # Error analysis
        errors = defaultdict(int)
        for result in results:
            if not result.success:
                error_key = result.error_message or f"HTTP_{result.status_code}"
                errors[error_key] += 1
        
        # Throughput calculation
        total_bytes = sum(r.response_size for r in results)
        throughput_mbps = (total_bytes * 8) / (duration * 1024 * 1024) if duration > 0 else 0
        
        # Success criteria evaluation
        success_criteria_met = self._evaluate_success_criteria(scenario, results)
        
        return TestReport(
            scenario_name=scenario.name,
            test_type=scenario.test_type,
            start_time=start_time,
            end_time=end_time,
            duration=duration,
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            requests_per_second=total_requests / duration if duration > 0 else 0,
            average_response_time=statistics.mean(response_times) if response_times else 0,
            min_response_time=min(response_times) if response_times else 0,
            max_response_time=max(response_times) if response_times else 0,
            p50_response_time=percentile(response_times, 50),
            p95_response_time=percentile(response_times, 95),
            p99_response_time=percentile(response_times, 99),
            error_rate=(failed_requests / total_requests * 100) if total_requests > 0 else 0,
            throughput_mbps=throughput_mbps,
            concurrent_users=scenario.concurrent_users,
            success_criteria_met=success_criteria_met,
            errors=dict(errors),
            response_time_distribution=response_times
        )

    def _create_empty_report(self, scenario: TestScenario) -> TestReport:
        """Create empty report for failed tests."""
        return TestReport(
            scenario_name=scenario.name,
            test_type=scenario.test_type,
            start_time=datetime.now(),
            end_time=datetime.now(),
            duration=0,
            total_requests=0,
            successful_requests=0,
            failed_requests=0,
            requests_per_second=0,
            average_response_time=0,
            min_response_time=0,
            max_response_time=0,
            p50_response_time=0,
            p95_response_time=0,
            p99_response_time=0,
            error_rate=100,
            throughput_mbps=0,
            concurrent_users=scenario.concurrent_users,
            success_criteria_met=False
        )

    def _evaluate_success_criteria(self, scenario: TestScenario, results: List[TestResult]) -> bool:
        """Evaluate if test meets success criteria."""
        criteria = scenario.success_criteria
        if not criteria:
            return True
        
        # Calculate metrics
        successful_requests = len([r for r in results if r.success])
        total_requests = len(results)
        error_rate = (total_requests - successful_requests) / total_requests * 100 if total_requests > 0 else 100
        
        response_times = [r.response_time for r in results if r.success]
        avg_response_time = statistics.mean(response_times) if response_times else float('inf')
        
        # Check criteria
        if 'max_error_rate' in criteria and error_rate > criteria['max_error_rate']:
            return False
        
        if 'max_avg_response_time' in criteria and avg_response_time > criteria['max_avg_response_time']:
            return False
        
        if 'min_requests_per_second' in criteria:
            duration = (max(r.timestamp for r in results) - min(r.timestamp for r in results)).total_seconds()
            rps = total_requests / duration if duration > 0 else 0
            if rps < criteria['min_requests_per_second']:
                return False
        
        return True

class LoadTestingFramework:
    """Main load testing framework."""
    
    def __init__(self):
        self.logger = self._setup_logging()
        self.load_generator = LoadGenerator()
        self.analyzer = TestAnalyzer()
        self.test_scenarios: Dict[str, TestScenario] = {}
        self.test_reports: List[TestReport] = []

    def _setup_logging(self) -> logging.Logger:
        """Setup logging for load testing."""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        return logging.getLogger(__name__)

    def add_scenario(self, scenario: TestScenario):
        """Add a test scenario."""
        self.test_scenarios[scenario.name] = scenario
        self.logger.info(f"Added test scenario: {scenario.name}")

    def run_scenario(self, scenario_name: str, use_async: bool = True) -> TestReport:
        """Run a specific test scenario."""
        if scenario_name not in self.test_scenarios:
            raise ValueError(f"Scenario '{scenario_name}' not found")
        
        scenario = self.test_scenarios[scenario_name]
        
        self.logger.info(f"Starting test scenario: {scenario_name}")
        self.logger.info(f"Test type: {scenario.test_type.value}")
        self.logger.info(f"Concurrent users: {scenario.concurrent_users}")
        self.logger.info(f"Duration: {scenario.duration_seconds}s")
        
        start_time = time.time()
        
        try:
            if use_async:
                results = asyncio.run(self.load_generator.run_async_test(scenario))
            else:
                results = self.load_generator.run_sync_test(scenario)
            
            # Analyze results
            report = self.analyzer.analyze_results(scenario, results)
            self.test_reports.append(report)
            
            duration = time.time() - start_time
            self.logger.info(f"Test completed in {duration:.2f}s")
            self.logger.info(f"Total requests: {report.total_requests}")
            self.logger.info(f"Success rate: {(report.successful_requests/report.total_requests*100):.1f}%")
            self.logger.info(f"Average response time: {report.average_response_time:.3f}s")
            
            return report
            
        except Exception as e:
            self.logger.error(f"Test scenario failed: {e}")
            raise

    def run_all_scenarios(self, use_async: bool = True) -> List[TestReport]:
        """Run all configured test scenarios."""
        reports = []
        
        for scenario_name in self.test_scenarios:
            try:
                report = self.run_scenario(scenario_name, use_async)
                reports.append(report)
            except Exception as e:
                self.logger.error(f"Failed to run scenario {scenario_name}: {e}")
        
        return reports

    def generate_html_report(self, reports: List[TestReport] = None) -> str:
        """Generate HTML report."""
        if reports is None:
            reports = self.test_reports
        
        html_content = self._create_html_report(reports)
        
        report_file = f"load_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        with open(report_file, 'w') as f:
            f.write(html_content)
        
        self.logger.info(f"HTML report generated: {report_file}")
        return report_file

    def _create_html_report(self, reports: List[TestReport]) -> str:
        """Create HTML report content."""
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Load Test Report - Pixelated Empathy AI</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
                .scenario { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
                .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
                .metric { background: #f9f9f9; padding: 10px; border-radius: 3px; }
                .success { color: green; }
                .failure { color: red; }
                .warning { color: orange; }
                table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Load Test Report - Pixelated Empathy AI</h1>
                <p>Generated: """ + datetime.now().strftime('%Y-%m-%d %H:%M:%S') + """</p>
                <p>Total Scenarios: """ + str(len(reports)) + """</p>
            </div>
        """
        
        for report in reports:
            status_class = "success" if report.success_criteria_met else "failure"
            
            html += f"""
            <div class="scenario">
                <h2>{report.scenario_name} <span class="{status_class}">({'PASS' if report.success_criteria_met else 'FAIL'})</span></h2>
                <p><strong>Test Type:</strong> {report.test_type.value}</p>
                <p><strong>Duration:</strong> {report.duration:.2f}s</p>
                
                <div class="metrics">
                    <div class="metric">
                        <strong>Total Requests</strong><br>
                        {report.total_requests:,}
                    </div>
                    <div class="metric">
                        <strong>Success Rate</strong><br>
                        {(report.successful_requests/report.total_requests*100):.1f}%
                    </div>
                    <div class="metric">
                        <strong>Requests/Second</strong><br>
                        {report.requests_per_second:.1f}
                    </div>
                    <div class="metric">
                        <strong>Avg Response Time</strong><br>
                        {report.average_response_time:.3f}s
                    </div>
                    <div class="metric">
                        <strong>95th Percentile</strong><br>
                        {report.p95_response_time:.3f}s
                    </div>
                    <div class="metric">
                        <strong>Throughput</strong><br>
                        {report.throughput_mbps:.2f} Mbps
                    </div>
                </div>
            """
            
            if report.errors:
                html += "<h3>Errors</h3><table><tr><th>Error</th><th>Count</th></tr>"
                for error, count in report.errors.items():
                    html += f"<tr><td>{error}</td><td>{count}</td></tr>"
                html += "</table>"
            
            html += "</div>"
        
        html += """
        </body>
        </html>
        """
        
        return html

def main():
    """Main function for testing the load testing framework."""
    print("🚀 LOAD TESTING FRAMEWORK TEST")
    print("=" * 50)
    
    # Initialize framework
    framework = LoadTestingFramework()
    
    # Create test scenarios
    load_test = TestScenario(
        name="basic_load_test",
        test_type=TestType.LOAD_TEST,
        target_url="http://httpbin.org/get",
        concurrent_users=10,
        duration_seconds=30,
        ramp_up_seconds=5,
        success_criteria={
            'max_error_rate': 5.0,
            'max_avg_response_time': 2.0
        }
    )
    
    stress_test = TestScenario(
        name="stress_test",
        test_type=TestType.STRESS_TEST,
        target_url="http://httpbin.org/get",
        concurrent_users=50,
        duration_seconds=20,
        ramp_up_seconds=10,
        success_criteria={
            'max_error_rate': 10.0
        }
    )
    
    framework.add_scenario(load_test)
    framework.add_scenario(stress_test)
    
    print(f"✅ Added {len(framework.test_scenarios)} test scenarios")
    
    # Run tests
    try:
        report1 = framework.run_scenario("basic_load_test", use_async=False)
        print(f"✅ Load test completed: {report1.total_requests} requests, {report1.error_rate:.1f}% error rate")
        
        report2 = framework.run_scenario("stress_test", use_async=False)
        print(f"✅ Stress test completed: {report2.total_requests} requests, {report2.error_rate:.1f}% error rate")
        
        # Generate report
        html_report = framework.generate_html_report()
        print(f"✅ HTML report generated: {html_report}")
        
    except Exception as e:
        print(f"❌ Test execution failed: {e}")
    
    print("\n🎉 Load testing framework is functional!")

if __name__ == "__main__":
    main()
