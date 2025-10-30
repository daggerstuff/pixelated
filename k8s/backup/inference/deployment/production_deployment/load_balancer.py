#!/usr/bin/env python3
"""
Load Balancer for Production Scaling System
Intelligent load balancing with health checks and traffic distribution.
"""

import os
import json
import logging
import time
import threading
import requests
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from enum import Enum
import random
import hashlib
from collections import defaultdict, deque

class LoadBalancingAlgorithm(Enum):
    """Load balancing algorithms."""
    ROUND_ROBIN = "round_robin"
    WEIGHTED_ROUND_ROBIN = "weighted_round_robin"
    LEAST_CONNECTIONS = "least_connections"
    LEAST_RESPONSE_TIME = "least_response_time"
    IP_HASH = "ip_hash"
    RANDOM = "random"
    HEALTH_BASED = "health_based"

class HealthStatus(Enum):
    """Health check status."""
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded"
    UNKNOWN = "unknown"

@dataclass
class BackendServer:
    """Backend server information."""
    server_id: str
    host: str
    port: int
    weight: int = 1
    max_connections: int = 1000
    current_connections: int = 0
    health_status: HealthStatus = HealthStatus.UNKNOWN
    response_time: float = 0.0
    last_health_check: Optional[datetime] = None
    consecutive_failures: int = 0
    total_requests: int = 0
    failed_requests: int = 0
    enabled: bool = True

@dataclass
class LoadBalancerStats:
    """Load balancer statistics."""
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    average_response_time: float = 0.0
    requests_per_second: float = 0.0
    active_connections: int = 0
    healthy_backends: int = 0
    total_backends: int = 0

class HealthChecker:
    """Health checker for backend servers."""
    
    def __init__(self, check_interval: int = 30, timeout: int = 5):
        self.check_interval = check_interval
        self.timeout = timeout
        self.checking = False
        self.checker_thread = None
        self.logger = logging.getLogger(__name__)

    def start_health_checks(self, servers: Dict[str, BackendServer]):
        """Start health checking."""
        if self.checking:
            return
        
        self.checking = True
        self.servers = servers
        self.checker_thread = threading.Thread(target=self._health_check_loop)
        self.checker_thread.daemon = True
        self.checker_thread.start()
        
        self.logger.info("Health checking started")

    def stop_health_checks(self):
        """Stop health checking."""
        self.checking = False
        if self.checker_thread:
            self.checker_thread.join()
        
        self.logger.info("Health checking stopped")

    def _health_check_loop(self):
        """Main health check loop."""
        while self.checking:
            try:
                for server in self.servers.values():
                    if server.enabled:
                        self._check_server_health(server)
                
                time.sleep(self.check_interval)
            except Exception as e:
                self.logger.error(f"Error in health check loop: {e}")
                time.sleep(self.check_interval)

    def _check_server_health(self, server: BackendServer):
        """Check health of a single server."""
        try:
            start_time = time.time()
            
            # Perform health check (HTTP GET to health endpoint)
            health_url = f"http://{server.host}:{server.port}/health"
            
            try:
                response = requests.get(health_url, timeout=self.timeout)
                response_time = time.time() - start_time
                
                if response.status_code == 200:
                    server.health_status = HealthStatus.HEALTHY
                    server.response_time = response_time
                    server.consecutive_failures = 0
                else:
                    server.health_status = HealthStatus.UNHEALTHY
                    server.consecutive_failures += 1
                    
            except requests.RequestException:
                server.health_status = HealthStatus.UNHEALTHY
                server.consecutive_failures += 1
            
            server.last_health_check = datetime.now()
            
            # Log health status changes
            if server.consecutive_failures == 1:
                self.logger.warning(f"Server {server.server_id} became unhealthy")
            elif server.consecutive_failures == 0 and server.health_status == HealthStatus.HEALTHY:
                self.logger.info(f"Server {server.server_id} is healthy")
                
        except Exception as e:
            self.logger.error(f"Health check failed for {server.server_id}: {e}")
            server.health_status = HealthStatus.UNKNOWN

class LoadBalancer:
    """Intelligent load balancer with multiple algorithms."""
    
    def __init__(self, algorithm: LoadBalancingAlgorithm = LoadBalancingAlgorithm.ROUND_ROBIN):
        self.algorithm = algorithm
        self.servers: Dict[str, BackendServer] = {}
        self.stats = LoadBalancerStats()
        self.health_checker = HealthChecker()
        self.request_history = deque(maxlen=1000)
        self.round_robin_index = 0
        self.logger = logging.getLogger(__name__)
        
        # Start health checking
        self.health_checker.start_health_checks(self.servers)

    def add_server(self, server_id: str, host: str, port: int, weight: int = 1):
        """Add a backend server."""
        server = BackendServer(
            server_id=server_id,
            host=host,
            port=port,
            weight=weight
        )
        
        self.servers[server_id] = server
        self.stats.total_backends = len(self.servers)
        
        self.logger.info(f"Added server: {server_id} ({host}:{port})")

    def remove_server(self, server_id: str):
        """Remove a backend server."""
        if server_id in self.servers:
            del self.servers[server_id]
            self.stats.total_backends = len(self.servers)
            self.logger.info(f"Removed server: {server_id}")

    def get_server(self, client_ip: str = None) -> Optional[BackendServer]:
        """Get next server based on load balancing algorithm."""
        healthy_servers = [
            server for server in self.servers.values()
            if server.enabled and server.health_status == HealthStatus.HEALTHY
        ]
        
        if not healthy_servers:
            self.logger.warning("No healthy servers available")
            return None
        
        if self.algorithm == LoadBalancingAlgorithm.ROUND_ROBIN:
            return self._round_robin_select(healthy_servers)
        elif self.algorithm == LoadBalancingAlgorithm.WEIGHTED_ROUND_ROBIN:
            return self._weighted_round_robin_select(healthy_servers)
        elif self.algorithm == LoadBalancingAlgorithm.LEAST_CONNECTIONS:
            return self._least_connections_select(healthy_servers)
        elif self.algorithm == LoadBalancingAlgorithm.LEAST_RESPONSE_TIME:
            return self._least_response_time_select(healthy_servers)
        elif self.algorithm == LoadBalancingAlgorithm.IP_HASH:
            return self._ip_hash_select(healthy_servers, client_ip)
        elif self.algorithm == LoadBalancingAlgorithm.RANDOM:
            return self._random_select(healthy_servers)
        elif self.algorithm == LoadBalancingAlgorithm.HEALTH_BASED:
            return self._health_based_select(healthy_servers)
        else:
            return self._round_robin_select(healthy_servers)

    def _round_robin_select(self, servers: List[BackendServer]) -> BackendServer:
        """Round robin selection."""
        if not servers:
            return None
        
        server = servers[self.round_robin_index % len(servers)]
        self.round_robin_index += 1
        return server

    def _weighted_round_robin_select(self, servers: List[BackendServer]) -> BackendServer:
        """Weighted round robin selection."""
        if not servers:
            return None
        
        # Create weighted list
        weighted_servers = []
        for server in servers:
            weighted_servers.extend([server] * server.weight)
        
        if not weighted_servers:
            return servers[0]
        
        server = weighted_servers[self.round_robin_index % len(weighted_servers)]
        self.round_robin_index += 1
        return server

    def _least_connections_select(self, servers: List[BackendServer]) -> BackendServer:
        """Least connections selection."""
        return min(servers, key=lambda s: s.current_connections)

    def _least_response_time_select(self, servers: List[BackendServer]) -> BackendServer:
        """Least response time selection."""
        return min(servers, key=lambda s: s.response_time)

    def _ip_hash_select(self, servers: List[BackendServer], client_ip: str) -> BackendServer:
        """IP hash selection for session affinity."""
        if not client_ip:
            return self._round_robin_select(servers)
        
        # Hash client IP to select server
        hash_value = int(hashlib.md5(client_ip.encode()).hexdigest(), 16)
        server_index = hash_value % len(servers)
        return servers[server_index]

    def _random_select(self, servers: List[BackendServer]) -> BackendServer:
        """Random selection."""
        return random.choice(servers)

    def _health_based_select(self, servers: List[BackendServer]) -> BackendServer:
        """Health-based selection (prefer servers with better health metrics)."""
        # Score servers based on health metrics
        scored_servers = []
        for server in servers:
            score = 0
            
            # Lower response time is better
            if server.response_time > 0:
                score += 1.0 / server.response_time
            
            # Lower connection count is better
            connection_ratio = server.current_connections / server.max_connections
            score += 1.0 - connection_ratio
            
            # Higher success rate is better
            if server.total_requests > 0:
                success_rate = (server.total_requests - server.failed_requests) / server.total_requests
                score += success_rate
            
            scored_servers.append((server, score))
        
        # Select server with highest score
        return max(scored_servers, key=lambda x: x[1])[0]

    def handle_request(self, client_ip: str = None) -> Tuple[Optional[BackendServer], bool]:
        """Handle incoming request and return selected server."""
        start_time = time.time()
        
        # Get server
        server = self.get_server(client_ip)
        
        if not server:
            self.stats.failed_requests += 1
            return None, False
        
        # Update server stats
        server.current_connections += 1
        server.total_requests += 1
        
        # Update load balancer stats
        self.stats.total_requests += 1
        self.stats.active_connections += 1
        
        # Record request
        self.request_history.append({
            'timestamp': datetime.now(),
            'server_id': server.server_id,
            'client_ip': client_ip,
            'response_time': time.time() - start_time
        })
        
        return server, True

    def complete_request(self, server: BackendServer, success: bool, response_time: float):
        """Mark request as completed."""
        # Update server stats
        server.current_connections = max(0, server.current_connections - 1)
        
        if not success:
            server.failed_requests += 1
            self.stats.failed_requests += 1
        else:
            self.stats.successful_requests += 1
        
        # Update response time
        server.response_time = (server.response_time + response_time) / 2
        
        # Update load balancer stats
        self.stats.active_connections = max(0, self.stats.active_connections - 1)
        self._update_stats()

    def _update_stats(self):
        """Update load balancer statistics."""
        # Calculate requests per second
        now = datetime.now()
        recent_requests = [
            req for req in self.request_history
            if req['timestamp'] > now - timedelta(seconds=60)
        ]
        self.stats.requests_per_second = len(recent_requests) / 60.0
        
        # Calculate average response time
        if recent_requests:
            self.stats.average_response_time = sum(
                req['response_time'] for req in recent_requests
            ) / len(recent_requests)
        
        # Count healthy backends
        self.stats.healthy_backends = len([
            server for server in self.servers.values()
            if server.health_status == HealthStatus.HEALTHY
        ])

    def get_stats(self) -> LoadBalancerStats:
        """Get current load balancer statistics."""
        self._update_stats()
        return self.stats

    def get_server_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get statistics for all servers."""
        return {
            server_id: {
                'host': server.host,
                'port': server.port,
                'health_status': server.health_status.value,
                'current_connections': server.current_connections,
                'total_requests': server.total_requests,
                'failed_requests': server.failed_requests,
                'success_rate': (server.total_requests - server.failed_requests) / server.total_requests * 100 if server.total_requests > 0 else 0,
                'response_time': server.response_time,
                'last_health_check': server.last_health_check.isoformat() if server.last_health_check else None
            }
            for server_id, server in self.servers.items()
        }

    def set_algorithm(self, algorithm: LoadBalancingAlgorithm):
        """Change load balancing algorithm."""
        self.algorithm = algorithm
        self.round_robin_index = 0  # Reset round robin counter
        self.logger.info(f"Load balancing algorithm changed to: {algorithm.value}")

    def enable_server(self, server_id: str):
        """Enable a server."""
        if server_id in self.servers:
            self.servers[server_id].enabled = True
            self.logger.info(f"Enabled server: {server_id}")

    def disable_server(self, server_id: str):
        """Disable a server."""
        if server_id in self.servers:
            self.servers[server_id].enabled = False
            self.logger.info(f"Disabled server: {server_id}")

    def shutdown(self):
        """Shutdown load balancer."""
        self.health_checker.stop_health_checks()
        self.logger.info("Load balancer shutdown")

def main():
    """Main function for testing the load balancer."""
    print("⚖️ LOAD BALANCER TEST")
    print("=" * 50)
    
    # Initialize load balancer
    lb = LoadBalancer(LoadBalancingAlgorithm.ROUND_ROBIN)
    
    # Add backend servers
    lb.add_server("server1", "localhost", 8001, weight=1)
    lb.add_server("server2", "localhost", 8002, weight=2)
    lb.add_server("server3", "localhost", 8003, weight=1)
    
    print(f"✅ Added {len(lb.servers)} backend servers")
    
    # Simulate some requests
    for i in range(10):
        client_ip = f"192.168.1.{i % 10 + 1}"
        server, success = lb.handle_request(client_ip)
        
        if success:
            # Simulate request processing
            import random
            response_time = random.uniform(0.1, 0.5)
            time.sleep(0.01)  # Brief delay
            
            # Complete request
            lb.complete_request(server, True, response_time)
            print(f"✅ Request {i+1} -> {server.server_id}")
        else:
            print(f"❌ Request {i+1} failed - no healthy servers")
    
    # Get statistics
    stats = lb.get_stats()
    print(f"✅ Total requests: {stats.total_requests}")
    print(f"✅ Successful requests: {stats.successful_requests}")
    print(f"✅ Average response time: {stats.average_response_time:.3f}s")
    print(f"✅ Requests per second: {stats.requests_per_second:.1f}")
    
    # Test different algorithms
    algorithms = [
        LoadBalancingAlgorithm.WEIGHTED_ROUND_ROBIN,
        LoadBalancingAlgorithm.LEAST_CONNECTIONS,
        LoadBalancingAlgorithm.RANDOM
    ]
    
    for algorithm in algorithms:
        lb.set_algorithm(algorithm)
        server, success = lb.handle_request("192.168.1.100")
        if success:
            lb.complete_request(server, True, 0.2)
            print(f"✅ {algorithm.value} -> {server.server_id}")
    
    # Get server statistics
    server_stats = lb.get_server_stats()
    print(f"✅ Server statistics collected for {len(server_stats)} servers")
    
    # Shutdown
    lb.shutdown()
    
    print("\n🎉 Load balancer is functional!")

if __name__ == "__main__":
    main()
