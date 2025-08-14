#!/usr/bin/env python3
"""
Performance Monitoring System
============================
"""

import json
import time
import psutil
import requests
from datetime import datetime
from typing import Dict, List, Any

class PerformanceMonitor:
    def __init__(self, target_url: str = "http://localhost:3000"):
        self.target_url = target_url
        self.metrics_history = []
        
    def collect_system_metrics(self) -> Dict[str, Any]:
        """Collect system performance metrics"""
        return {
            'timestamp': datetime.utcnow().isoformat(),
            'cpu': {
                'usage_percent': psutil.cpu_percent(interval=1),
                'load_average': psutil.getloadavg(),
                'core_count': psutil.cpu_count()
            },
            'memory': {
                'total': psutil.virtual_memory().total,
                'available': psutil.virtual_memory().available,
                'percent': psutil.virtual_memory().percent,
                'used': psutil.virtual_memory().used
            },
            'disk': {
                'usage_percent': psutil.disk_usage('/').percent,
                'free_space': psutil.disk_usage('/').free,
                'total_space': psutil.disk_usage('/').total
            },
            'network': {
                'bytes_sent': psutil.net_io_counters().bytes_sent,
                'bytes_recv': psutil.net_io_counters().bytes_recv,
                'packets_sent': psutil.net_io_counters().packets_sent,
                'packets_recv': psutil.net_io_counters().packets_recv
            }
        }
    
    def collect_application_metrics(self) -> Dict[str, Any]:
        """Collect application performance metrics"""
        try:
            # Health check endpoint
            start_time = time.time()
            health_response = requests.get(f"{self.target_url}/health", timeout=5)
            health_response_time = (time.time() - start_time) * 1000
            
            # API endpoint
            start_time = time.time()
            api_response = requests.get(f"{self.target_url}/api/health", timeout=5)
            api_response_time = (time.time() - start_time) * 1000
            
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'health_check': {
                    'status_code': health_response.status_code,
                    'response_time_ms': health_response_time,
                    'available': health_response.status_code == 200
                },
                'api_performance': {
                    'status_code': api_response.status_code,
                    'response_time_ms': api_response_time,
                    'available': api_response.status_code == 200
                }
            }
        except Exception as e:
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'error': str(e),
                'health_check': {'available': False},
                'api_performance': {'available': False}
            }
    
    def collect_database_metrics(self) -> Dict[str, Any]:
        """Collect database performance metrics"""
        # This would connect to your database and collect metrics
        # For now, returning mock data
        return {
            'timestamp': datetime.utcnow().isoformat(),
            'connections': {
                'active': 15,
                'idle': 5,
                'max': 50
            },
            'query_performance': {
                'avg_query_time_ms': 45.2,
                'slow_queries_count': 2,
                'queries_per_second': 125.5
            },
            'cache_hit_ratio': 0.95
        }
    
    def analyze_performance_trends(self) -> Dict[str, Any]:
        """Analyze performance trends from collected metrics"""
        if len(self.metrics_history) < 2:
            return {'status': 'insufficient_data'}
        
        # Calculate trends (simplified)
        recent_metrics = self.metrics_history[-10:]  # Last 10 measurements
        
        cpu_trend = 'stable'  # Would calculate actual trend
        memory_trend = 'increasing'  # Would calculate actual trend
        response_time_trend = 'improving'  # Would calculate actual trend
        
        return {
            'analysis_timestamp': datetime.utcnow().isoformat(),
            'trends': {
                'cpu_usage': cpu_trend,
                'memory_usage': memory_trend,
                'response_time': response_time_trend
            },
            'recommendations': self.generate_recommendations(recent_metrics)
        }
    
    def generate_recommendations(self, metrics: List[Dict]) -> List[str]:
        """Generate performance optimization recommendations"""
        recommendations = []
        
        # Analyze metrics and generate recommendations
        if any(m.get('system', {}).get('cpu', {}).get('usage_percent', 0) > 80 for m in metrics):
            recommendations.append("High CPU usage detected - consider scaling horizontally")
        
        if any(m.get('system', {}).get('memory', {}).get('percent', 0) > 85 for m in metrics):
            recommendations.append("High memory usage detected - investigate memory leaks")
        
        if any(m.get('application', {}).get('health_check', {}).get('response_time_ms', 0) > 2000 for m in metrics):
            recommendations.append("Slow response times detected - optimize application performance")
        
        return recommendations
    
    def monitor_continuously(self, duration_minutes: int = 60, interval_seconds: int = 30):
        """Run continuous performance monitoring"""
        end_time = time.time() + (duration_minutes * 60)
        
        print(f"Starting continuous monitoring for {duration_minutes} minutes...")
        
        while time.time() < end_time:
            # Collect all metrics
            system_metrics = self.collect_system_metrics()
            app_metrics = self.collect_application_metrics()
            db_metrics = self.collect_database_metrics()
            
            # Combine metrics
            combined_metrics = {
                'system': system_metrics,
                'application': app_metrics,
                'database': db_metrics
            }
            
            self.metrics_history.append(combined_metrics)
            
            # Keep only last 100 measurements
            if len(self.metrics_history) > 100:
                self.metrics_history = self.metrics_history[-100:]
            
            # Check for alerts
            self.check_performance_alerts(combined_metrics)
            
            time.sleep(interval_seconds)
        
        # Generate final report
        return self.generate_monitoring_report()
    
    def check_performance_alerts(self, metrics: Dict[str, Any]):
        """Check for performance alerts"""
        alerts = []
        
        # CPU alert
        cpu_usage = metrics['system']['cpu']['usage_percent']
        if cpu_usage > 90:
            alerts.append(f"CRITICAL: CPU usage at {cpu_usage}%")
        elif cpu_usage > 80:
            alerts.append(f"WARNING: CPU usage at {cpu_usage}%")
        
        # Memory alert
        memory_usage = metrics['system']['memory']['percent']
        if memory_usage > 95:
            alerts.append(f"CRITICAL: Memory usage at {memory_usage}%")
        elif memory_usage > 85:
            alerts.append(f"WARNING: Memory usage at {memory_usage}%")
        
        # Response time alert
        if 'health_check' in metrics['application']:
            response_time = metrics['application']['health_check'].get('response_time_ms', 0)
            if response_time > 5000:
                alerts.append(f"CRITICAL: Response time {response_time}ms")
            elif response_time > 2000:
                alerts.append(f"WARNING: Response time {response_time}ms")
        
        # Send alerts if any
        if alerts:
            self.send_alerts(alerts)
    
    def send_alerts(self, alerts: List[str]):
        """Send performance alerts"""
        for alert in alerts:
            print(f"🚨 ALERT: {alert}")
            # In production, this would send to Slack, email, PagerDuty, etc.
    
    def generate_monitoring_report(self) -> Dict[str, Any]:
        """Generate comprehensive monitoring report"""
        if not self.metrics_history:
            return {'error': 'No metrics collected'}
        
        # Calculate summary statistics
        cpu_values = [m['system']['cpu']['usage_percent'] for m in self.metrics_history]
        memory_values = [m['system']['memory']['percent'] for m in self.metrics_history]
        
        report = {
            'monitoring_report': {
                'timestamp': datetime.utcnow().isoformat(),
                'monitoring_duration_minutes': len(self.metrics_history) * 0.5,  # Assuming 30s intervals
                'total_measurements': len(self.metrics_history),
                'summary_statistics': {
                    'cpu_usage': {
                        'avg': sum(cpu_values) / len(cpu_values),
                        'max': max(cpu_values),
                        'min': min(cpu_values)
                    },
                    'memory_usage': {
                        'avg': sum(memory_values) / len(memory_values),
                        'max': max(memory_values),
                        'min': min(memory_values)
                    }
                },
                'performance_trends': self.analyze_performance_trends(),
                'recommendations': self.generate_recommendations(self.metrics_history)
            }
        }
        
        return report

if __name__ == "__main__":
    monitor = PerformanceMonitor()
    
    # Run monitoring for 10 minutes with 30-second intervals
    report = monitor.monitor_continuously(duration_minutes=10, interval_seconds=30)
    
    # Save report
    with open(f'/tmp/performance-monitoring-{datetime.now().strftime("%Y%m%d_%H%M%S")}.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print("✅ Performance monitoring completed")
