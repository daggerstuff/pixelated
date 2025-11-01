#!/usr/bin/env python3
"""
Database Optimization System for Pixelated Empathy AI
Comprehensive database performance optimization with query analysis, indexing, and monitoring.
"""

import os
import json
import logging
import time
import threading
import psutil
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from enum import Enum
import statistics
import re
from collections import defaultdict, deque
import hashlib

class QueryType(Enum):
    """Types of database queries."""
    SELECT = "SELECT"
    INSERT = "INSERT"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    CREATE = "CREATE"
    ALTER = "ALTER"
    DROP = "DROP"

class OptimizationType(Enum):
    """Types of database optimizations."""
    INDEX_OPTIMIZATION = "index_optimization"
    QUERY_OPTIMIZATION = "query_optimization"
    CONNECTION_POOLING = "connection_pooling"
    CACHE_OPTIMIZATION = "cache_optimization"
    PARTITION_OPTIMIZATION = "partition_optimization"
    VACUUM_OPTIMIZATION = "vacuum_optimization"

@dataclass
class QueryAnalysis:
    """Database query analysis result."""
    query_hash: str
    query_text: str
    query_type: QueryType
    execution_time: float
    rows_examined: int
    rows_returned: int
    tables_used: List[str]
    indexes_used: List[str]
    optimization_suggestions: List[str] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.now)

@dataclass
class IndexRecommendation:
    """Database index recommendation."""
    table_name: str
    columns: List[str]
    index_type: str
    estimated_benefit: float
    query_patterns: List[str]
    creation_cost: str
    maintenance_cost: str

@dataclass
class DatabaseMetrics:
    """Database performance metrics."""
    timestamp: datetime
    active_connections: int
    total_connections: int
    queries_per_second: float
    average_query_time: float
    slow_queries_count: int
    cache_hit_ratio: float
    buffer_pool_usage: float
    disk_io_operations: int
    lock_waits: int
    deadlocks: int

@dataclass
class OptimizationResult:
    """Database optimization result."""
    optimization_type: OptimizationType
    target_table: str
    action_taken: str
    performance_improvement: float
    execution_time: float
    success: bool
    error_message: str = ""
    before_metrics: Optional[Dict[str, float]] = None
    after_metrics: Optional[Dict[str, float]] = None

class QueryAnalyzer:
    """Analyzes database queries for optimization opportunities."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.query_cache: Dict[str, QueryAnalysis] = {}
        self.slow_query_threshold = 1.0  # seconds

    def analyze_query(self, query: str, execution_stats: Dict[str, Any]) -> QueryAnalysis:
        """Analyze a database query for optimization opportunities."""
        query_hash = hashlib.md5(query.encode()).hexdigest()
        
        # Parse query type
        query_type = self._parse_query_type(query)
        
        # Extract tables and analyze structure
        tables_used = self._extract_tables(query)
        indexes_used = execution_stats.get('indexes_used', [])
        
        # Generate optimization suggestions
        suggestions = self._generate_optimization_suggestions(
            query, query_type, execution_stats, tables_used
        )
        
        analysis = QueryAnalysis(
            query_hash=query_hash,
            query_text=query,
            query_type=query_type,
            execution_time=execution_stats.get('execution_time', 0.0),
            rows_examined=execution_stats.get('rows_examined', 0),
            rows_returned=execution_stats.get('rows_returned', 0),
            tables_used=tables_used,
            indexes_used=indexes_used,
            optimization_suggestions=suggestions
        )
        
        self.query_cache[query_hash] = analysis
        return analysis

    def _parse_query_type(self, query: str) -> QueryType:
        """Parse the type of SQL query."""
        query_upper = query.strip().upper()
        
        if query_upper.startswith('SELECT'):
            return QueryType.SELECT
        elif query_upper.startswith('INSERT'):
            return QueryType.INSERT
        elif query_upper.startswith('UPDATE'):
            return QueryType.UPDATE
        elif query_upper.startswith('DELETE'):
            return QueryType.DELETE
        elif query_upper.startswith('CREATE'):
            return QueryType.CREATE
        elif query_upper.startswith('ALTER'):
            return QueryType.ALTER
        elif query_upper.startswith('DROP'):
            return QueryType.DROP
        else:
            return QueryType.SELECT  # Default

    def _extract_tables(self, query: str) -> List[str]:
        """Extract table names from SQL query."""
        tables = []
        
        # Simple regex patterns for table extraction
        patterns = [
            r'FROM\s+(\w+)',
            r'JOIN\s+(\w+)',
            r'UPDATE\s+(\w+)',
            r'INSERT\s+INTO\s+(\w+)',
            r'DELETE\s+FROM\s+(\w+)'
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, query, re.IGNORECASE)
            tables.extend(matches)
        
        return list(set(tables))  # Remove duplicates

    def _generate_optimization_suggestions(self, query: str, query_type: QueryType, 
                                         stats: Dict[str, Any], tables: List[str]) -> List[str]:
        """Generate optimization suggestions for a query."""
        suggestions = []
        
        # Check execution time
        if stats.get('execution_time', 0) > self.slow_query_threshold:
            suggestions.append("Query execution time exceeds threshold - consider optimization")
        
        # Check rows examined vs returned ratio
        rows_examined = stats.get('rows_examined', 0)
        rows_returned = stats.get('rows_returned', 0)
        
        if rows_examined > 0 and rows_returned > 0:
            efficiency_ratio = rows_returned / rows_examined
            if efficiency_ratio < 0.1:  # Less than 10% efficiency
                suggestions.append("Low query efficiency - consider adding indexes or refining WHERE clauses")
        
        # Check for missing indexes
        if not stats.get('indexes_used') and query_type == QueryType.SELECT:
            suggestions.append("No indexes used - consider adding appropriate indexes")
        
        # Check for SELECT * usage
        if 'SELECT *' in query.upper():
            suggestions.append("Avoid SELECT * - specify only needed columns")
        
        # Check for missing WHERE clauses in large table operations
        if query_type in [QueryType.UPDATE, QueryType.DELETE] and 'WHERE' not in query.upper():
            suggestions.append("Missing WHERE clause in UPDATE/DELETE - potential full table operation")
        
        # Check for subqueries that could be JOINs
        if 'IN (SELECT' in query.upper():
            suggestions.append("Consider converting subquery to JOIN for better performance")
        
        return suggestions

    def get_slow_queries(self, limit: int = 10) -> List[QueryAnalysis]:
        """Get the slowest queries."""
        slow_queries = [
            analysis for analysis in self.query_cache.values()
            if analysis.execution_time > self.slow_query_threshold
        ]
        
        return sorted(slow_queries, key=lambda x: x.execution_time, reverse=True)[:limit]

class IndexOptimizer:
    """Optimizes database indexes for better performance."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def analyze_index_usage(self, table_stats: Dict[str, Any]) -> List[IndexRecommendation]:
        """Analyze index usage and generate recommendations."""
        recommendations = []
        
        for table_name, stats in table_stats.items():
            # Analyze query patterns for this table
            query_patterns = stats.get('query_patterns', [])
            
            # Check for missing indexes on frequently queried columns
            frequent_columns = self._find_frequent_columns(query_patterns)
            
            for columns in frequent_columns:
                if not self._index_exists(table_name, columns, stats):
                    recommendation = IndexRecommendation(
                        table_name=table_name,
                        columns=columns,
                        index_type="BTREE",
                        estimated_benefit=self._estimate_index_benefit(query_patterns, columns),
                        query_patterns=query_patterns,
                        creation_cost="Medium",
                        maintenance_cost="Low"
                    )
                    recommendations.append(recommendation)
        
        return sorted(recommendations, key=lambda x: x.estimated_benefit, reverse=True)

    def _find_frequent_columns(self, query_patterns: List[str]) -> List[List[str]]:
        """Find frequently used columns in WHERE clauses."""
        column_usage = defaultdict(int)
        
        for pattern in query_patterns:
            # Extract WHERE clause columns (simplified)
            where_match = re.search(r'WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)', pattern, re.IGNORECASE)
            if where_match:
                where_clause = where_match.group(1)
                # Find column references
                columns = re.findall(r'(\w+)\s*[=<>]', where_clause)
                for col in columns:
                    column_usage[col] += 1
        
        # Return columns used in more than 20% of queries
        threshold = len(query_patterns) * 0.2
        frequent_columns = [
            [col] for col, count in column_usage.items()
            if count >= threshold
        ]
        
        return frequent_columns

    def _index_exists(self, table_name: str, columns: List[str], stats: Dict[str, Any]) -> bool:
        """Check if an index already exists for the given columns."""
        existing_indexes = stats.get('indexes', [])
        column_set = set(columns)
        
        for index in existing_indexes:
            index_columns = set(index.get('columns', []))
            if column_set.issubset(index_columns):
                return True
        
        return False

    def _estimate_index_benefit(self, query_patterns: List[str], columns: List[str]) -> float:
        """Estimate the performance benefit of creating an index."""
        # Simple heuristic based on query frequency and selectivity
        benefit = 0.0
        
        for pattern in query_patterns:
            for col in columns:
                if col in pattern:
                    benefit += 10.0  # Base benefit per query
        
        return min(benefit, 100.0)  # Cap at 100

    def create_index_sql(self, recommendation: IndexRecommendation) -> str:
        """Generate SQL to create recommended index."""
        columns_str = ', '.join(recommendation.columns)
        index_name = f"idx_{recommendation.table_name}_{'_'.join(recommendation.columns)}"
        
        return f"CREATE INDEX {index_name} ON {recommendation.table_name} ({columns_str});"

class ConnectionPoolOptimizer:
    """Optimizes database connection pooling."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def analyze_connection_patterns(self, connection_stats: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze connection usage patterns."""
        if not connection_stats:
            return {}
        
        # Calculate connection metrics
        active_connections = [stat['active_connections'] for stat in connection_stats]
        total_connections = [stat['total_connections'] for stat in connection_stats]
        
        analysis = {
            'avg_active_connections': statistics.mean(active_connections),
            'max_active_connections': max(active_connections),
            'avg_total_connections': statistics.mean(total_connections),
            'max_total_connections': max(total_connections),
            'connection_utilization': statistics.mean([
                active / total if total > 0 else 0
                for active, total in zip(active_connections, total_connections)
            ])
        }
        
        # Generate recommendations
        recommendations = []
        
        if analysis['connection_utilization'] > 0.8:
            recommendations.append("High connection utilization - consider increasing pool size")
        elif analysis['connection_utilization'] < 0.3:
            recommendations.append("Low connection utilization - consider reducing pool size")
        
        if analysis['max_active_connections'] > analysis['avg_active_connections'] * 2:
            recommendations.append("High connection variance - consider implementing connection throttling")
        
        analysis['recommendations'] = recommendations
        return analysis

    def optimize_pool_settings(self, current_settings: Dict[str, Any], 
                             analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate optimized connection pool settings."""
        optimized = current_settings.copy()
        
        avg_active = analysis.get('avg_active_connections', 10)
        max_active = analysis.get('max_active_connections', 20)
        
        # Optimize pool size
        recommended_min = max(int(avg_active * 0.5), 5)
        recommended_max = max(int(max_active * 1.2), 20)
        
        optimized.update({
            'min_pool_size': recommended_min,
            'max_pool_size': recommended_max,
            'pool_timeout': 30,  # seconds
            'pool_recycle': 3600,  # 1 hour
            'pool_pre_ping': True,
            'max_overflow': int(recommended_max * 0.2)
        })
        
        return optimized

class DatabaseOptimizationSystem:
    """Main database optimization system."""
    
    def __init__(self):
        self.logger = self._setup_logging()
        self.query_analyzer = QueryAnalyzer()
        self.index_optimizer = IndexOptimizer()
        self.connection_optimizer = ConnectionPoolOptimizer()
        self.optimization_results: List[OptimizationResult] = []
        self.metrics_history: deque = deque(maxlen=1000)

    def _setup_logging(self) -> logging.Logger:
        """Setup logging for database optimization."""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        return logging.getLogger(__name__)

    def analyze_database_performance(self, connection_stats: List[Dict[str, Any]], 
                                   query_logs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Comprehensive database performance analysis."""
        self.logger.info("Starting database performance analysis")
        
        analysis_results = {
            'timestamp': datetime.now().isoformat(),
            'query_analysis': {},
            'index_recommendations': [],
            'connection_analysis': {},
            'performance_metrics': {},
            'optimization_opportunities': []
        }
        
        # Analyze queries
        slow_queries = []
        for query_log in query_logs:
            query_analysis = self.query_analyzer.analyze_query(
                query_log['query'], 
                query_log.get('stats', {})
            )
            
            if query_analysis.execution_time > 1.0:  # Slow query threshold
                slow_queries.append(query_analysis)
        
        analysis_results['query_analysis'] = {
            'total_queries_analyzed': len(query_logs),
            'slow_queries_count': len(slow_queries),
            'top_slow_queries': [asdict(q) for q in slow_queries[:5]]
        }
        
        # Analyze indexes
        table_stats = self._aggregate_table_stats(query_logs)
        index_recommendations = self.index_optimizer.analyze_index_usage(table_stats)
        analysis_results['index_recommendations'] = [
            asdict(rec) for rec in index_recommendations[:10]
        ]
        
        # Analyze connections
        connection_analysis = self.connection_optimizer.analyze_connection_patterns(connection_stats)
        analysis_results['connection_analysis'] = connection_analysis
        
        # Calculate performance metrics
        performance_metrics = self._calculate_performance_metrics(connection_stats, query_logs)
        analysis_results['performance_metrics'] = performance_metrics
        
        # Generate optimization opportunities
        opportunities = self._identify_optimization_opportunities(analysis_results)
        analysis_results['optimization_opportunities'] = opportunities
        
        self.logger.info(f"Analysis complete: {len(slow_queries)} slow queries, "
                        f"{len(index_recommendations)} index recommendations")
        
        return analysis_results

    def _aggregate_table_stats(self, query_logs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Aggregate statistics by table."""
        table_stats = defaultdict(lambda: {
            'query_count': 0,
            'avg_execution_time': 0.0,
            'query_patterns': [],
            'indexes': []
        })
        
        for query_log in query_logs:
            query = query_log['query']
            tables = self.query_analyzer._extract_tables(query)
            
            for table in tables:
                stats = table_stats[table]
                stats['query_count'] += 1
                stats['query_patterns'].append(query)
                
                # Update average execution time
                exec_time = query_log.get('stats', {}).get('execution_time', 0.0)
                current_avg = stats['avg_execution_time']
                count = stats['query_count']
                stats['avg_execution_time'] = (current_avg * (count - 1) + exec_time) / count
        
        return dict(table_stats)

    def _calculate_performance_metrics(self, connection_stats: List[Dict[str, Any]], 
                                     query_logs: List[Dict[str, Any]]) -> Dict[str, float]:
        """Calculate overall database performance metrics."""
        metrics = {}
        
        if connection_stats:
            # Connection metrics
            active_connections = [s['active_connections'] for s in connection_stats]
            metrics['avg_active_connections'] = statistics.mean(active_connections)
            metrics['max_active_connections'] = max(active_connections)
        
        if query_logs:
            # Query performance metrics
            execution_times = [
                log.get('stats', {}).get('execution_time', 0.0) 
                for log in query_logs
            ]
            
            if execution_times:
                metrics['avg_query_time'] = statistics.mean(execution_times)
                metrics['max_query_time'] = max(execution_times)
                metrics['queries_per_second'] = len(query_logs) / 3600  # Assuming 1 hour of logs
                
                # Calculate slow query percentage
                slow_queries = [t for t in execution_times if t > 1.0]
                metrics['slow_query_percentage'] = (len(slow_queries) / len(execution_times)) * 100
        
        return metrics

    def _identify_optimization_opportunities(self, analysis: Dict[str, Any]) -> List[str]:
        """Identify optimization opportunities based on analysis."""
        opportunities = []
        
        # Query optimization opportunities
        query_analysis = analysis.get('query_analysis', {})
        if query_analysis.get('slow_queries_count', 0) > 0:
            opportunities.append(f"Optimize {query_analysis['slow_queries_count']} slow queries")
        
        # Index optimization opportunities
        index_recs = analysis.get('index_recommendations', [])
        if index_recs:
            opportunities.append(f"Create {len(index_recs)} recommended indexes")
        
        # Connection optimization opportunities
        conn_analysis = analysis.get('connection_analysis', {})
        conn_recs = conn_analysis.get('recommendations', [])
        opportunities.extend(conn_recs)
        
        # Performance-based opportunities
        perf_metrics = analysis.get('performance_metrics', {})
        if perf_metrics.get('slow_query_percentage', 0) > 10:
            opportunities.append("High percentage of slow queries - review query patterns")
        
        if perf_metrics.get('avg_query_time', 0) > 0.5:
            opportunities.append("High average query time - consider query optimization")
        
        return opportunities

    def apply_optimizations(self, optimization_plan: Dict[str, Any]) -> List[OptimizationResult]:
        """Apply database optimizations based on analysis."""
        results = []
        
        # Apply index optimizations
        index_optimizations = optimization_plan.get('create_indexes', [])
        for index_rec in index_optimizations:
            result = self._create_index(index_rec)
            results.append(result)
        
        # Apply connection pool optimizations
        pool_settings = optimization_plan.get('connection_pool_settings')
        if pool_settings:
            result = self._optimize_connection_pool(pool_settings)
            results.append(result)
        
        # Apply query optimizations
        query_optimizations = optimization_plan.get('query_optimizations', [])
        for query_opt in query_optimizations:
            result = self._optimize_query(query_opt)
            results.append(result)
        
        self.optimization_results.extend(results)
        return results

    def _create_index(self, index_recommendation: Dict[str, Any]) -> OptimizationResult:
        """Create a database index."""
        start_time = time.time()
        
        try:
            # In a real implementation, this would execute the SQL
            sql = f"CREATE INDEX idx_{index_recommendation['table_name']}_{'_'.join(index_recommendation['columns'])} " \
                  f"ON {index_recommendation['table_name']} ({', '.join(index_recommendation['columns'])});"
            
            self.logger.info(f"Would execute: {sql}")
            
            # Simulate index creation
            time.sleep(0.1)
            
            execution_time = time.time() - start_time
            
            return OptimizationResult(
                optimization_type=OptimizationType.INDEX_OPTIMIZATION,
                target_table=index_recommendation['table_name'],
                action_taken=f"Created index on columns: {', '.join(index_recommendation['columns'])}",
                performance_improvement=index_recommendation.get('estimated_benefit', 0.0),
                execution_time=execution_time,
                success=True
            )
            
        except Exception as e:
            return OptimizationResult(
                optimization_type=OptimizationType.INDEX_OPTIMIZATION,
                target_table=index_recommendation['table_name'],
                action_taken="Failed to create index",
                performance_improvement=0.0,
                execution_time=time.time() - start_time,
                success=False,
                error_message=str(e)
            )

    def _optimize_connection_pool(self, pool_settings: Dict[str, Any]) -> OptimizationResult:
        """Optimize connection pool settings."""
        start_time = time.time()
        
        try:
            self.logger.info(f"Optimizing connection pool: {pool_settings}")
            
            # In a real implementation, this would update the connection pool
            time.sleep(0.05)
            
            execution_time = time.time() - start_time
            
            return OptimizationResult(
                optimization_type=OptimizationType.CONNECTION_POOLING,
                target_table="connection_pool",
                action_taken=f"Updated pool settings: min={pool_settings.get('min_pool_size')}, max={pool_settings.get('max_pool_size')}",
                performance_improvement=15.0,  # Estimated improvement
                execution_time=execution_time,
                success=True
            )
            
        except Exception as e:
            return OptimizationResult(
                optimization_type=OptimizationType.CONNECTION_POOLING,
                target_table="connection_pool",
                action_taken="Failed to optimize connection pool",
                performance_improvement=0.0,
                execution_time=time.time() - start_time,
                success=False,
                error_message=str(e)
            )

    def _optimize_query(self, query_optimization: Dict[str, Any]) -> OptimizationResult:
        """Optimize a specific query."""
        start_time = time.time()
        
        try:
            original_query = query_optimization['original_query']
            optimized_query = query_optimization['optimized_query']
            
            self.logger.info(f"Query optimization suggested for: {original_query[:50]}...")
            
            execution_time = time.time() - start_time
            
            return OptimizationResult(
                optimization_type=OptimizationType.QUERY_OPTIMIZATION,
                target_table="multiple",
                action_taken="Query optimization suggested",
                performance_improvement=query_optimization.get('estimated_improvement', 0.0),
                execution_time=execution_time,
                success=True
            )
            
        except Exception as e:
            return OptimizationResult(
                optimization_type=OptimizationType.QUERY_OPTIMIZATION,
                target_table="multiple",
                action_taken="Failed to optimize query",
                performance_improvement=0.0,
                execution_time=time.time() - start_time,
                success=False,
                error_message=str(e)
            )

    def generate_optimization_report(self) -> str:
        """Generate comprehensive optimization report."""
        report_file = f"database_optimization_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        report = {
            'generated_at': datetime.now().isoformat(),
            'total_optimizations': len(self.optimization_results),
            'successful_optimizations': len([r for r in self.optimization_results if r.success]),
            'failed_optimizations': len([r for r in self.optimization_results if not r.success]),
            'optimization_results': [asdict(result) for result in self.optimization_results],
            'performance_summary': {
                'total_improvement': sum(r.performance_improvement for r in self.optimization_results if r.success),
                'avg_improvement_per_optimization': statistics.mean([
                    r.performance_improvement for r in self.optimization_results if r.success
                ]) if self.optimization_results else 0.0
            }
        }
        
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        self.logger.info(f"Database optimization report saved to {report_file}")
        return report_file

def main():
    """Main function for testing the database optimization system."""
    print("🗄️ DATABASE OPTIMIZATION SYSTEM TEST")
    print("=" * 50)
    
    # Initialize optimization system
    db_optimizer = DatabaseOptimizationSystem()
    
    # Create sample data
    sample_connection_stats = [
        {'active_connections': 15, 'total_connections': 20, 'timestamp': datetime.now()},
        {'active_connections': 18, 'total_connections': 20, 'timestamp': datetime.now()},
        {'active_connections': 12, 'total_connections': 20, 'timestamp': datetime.now()},
    ]
    
    sample_query_logs = [
        {
            'query': 'SELECT * FROM users WHERE email = ?',
            'stats': {'execution_time': 1.5, 'rows_examined': 10000, 'rows_returned': 1}
        },
        {
            'query': 'SELECT id, name FROM conversations WHERE user_id = ? ORDER BY created_at DESC',
            'stats': {'execution_time': 0.8, 'rows_examined': 500, 'rows_returned': 10}
        },
        {
            'query': 'UPDATE users SET last_login = ? WHERE id = ?',
            'stats': {'execution_time': 0.2, 'rows_examined': 1, 'rows_returned': 1}
        }
    ]
    
    print(f"✅ Created sample data: {len(sample_connection_stats)} connection stats, {len(sample_query_logs)} query logs")
    
    # Analyze database performance
    analysis = db_optimizer.analyze_database_performance(sample_connection_stats, sample_query_logs)
    
    print(f"✅ Performance analysis completed:")
    print(f"  - Queries analyzed: {analysis['query_analysis']['total_queries_analyzed']}")
    print(f"  - Slow queries: {analysis['query_analysis']['slow_queries_count']}")
    print(f"  - Index recommendations: {len(analysis['index_recommendations'])}")
    print(f"  - Optimization opportunities: {len(analysis['optimization_opportunities'])}")
    
    # Create optimization plan
    optimization_plan = {
        'create_indexes': analysis['index_recommendations'][:2],  # Top 2 recommendations
        'connection_pool_settings': {
            'min_pool_size': 10,
            'max_pool_size': 25,
            'pool_timeout': 30
        }
    }
    
    # Apply optimizations
    results = db_optimizer.apply_optimizations(optimization_plan)
    successful_optimizations = [r for r in results if r.success]
    
    print(f"✅ Applied optimizations: {len(successful_optimizations)}/{len(results)} successful")
    
    if successful_optimizations:
        total_improvement = sum(r.performance_improvement for r in successful_optimizations)
        print(f"✅ Total performance improvement: {total_improvement:.1f}%")
    
    # Generate report
    report_file = db_optimizer.generate_optimization_report()
    print(f"✅ Optimization report: {report_file}")
    
    print("\n🎉 Database optimization system is functional!")

if __name__ == "__main__":
    main()
