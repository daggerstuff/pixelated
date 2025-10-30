#!/usr/bin/env python3
"""
Production Logging System for Pixelated Empathy AI
Comprehensive logging with structured logs, aggregation, and analysis.
"""

import os
import json
import logging
import logging.handlers
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from enum import Enum
import threading
import queue
import gzip
import shutil
from collections import defaultdict, deque
import re

class LogLevel(Enum):
    """Log levels with numeric values."""
    DEBUG = 10
    INFO = 20
    WARNING = 30
    ERROR = 40
    CRITICAL = 50

class LogCategory(Enum):
    """Log categories for better organization."""
    APPLICATION = "application"
    SECURITY = "security"
    PERFORMANCE = "performance"
    AI_INFERENCE = "ai_inference"
    DATABASE = "database"
    CACHE = "cache"
    HTTP = "http"
    SYSTEM = "system"
    AUDIT = "audit"

@dataclass
class LogEntry:
    """Structured log entry."""
    timestamp: datetime
    level: LogLevel
    category: LogCategory
    message: str
    logger_name: str
    module: str
    function: str
    line_number: int
    thread_id: int
    process_id: int
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    request_id: Optional[str] = None
    extra_data: Dict[str, Any] = field(default_factory=dict)
    stack_trace: Optional[str] = None

@dataclass
class LogAnalytics:
    """Log analytics and statistics."""
    total_logs: int
    logs_by_level: Dict[str, int]
    logs_by_category: Dict[str, int]
    error_patterns: Dict[str, int]
    top_loggers: Dict[str, int]
    time_range: Dict[str, datetime]

class StructuredFormatter(logging.Formatter):
    """Custom formatter for structured JSON logging."""
    
    def __init__(self, include_extra: bool = True):
        super().__init__()
        self.include_extra = include_extra

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as structured JSON."""
        # Extract context information
        log_entry = {
            'timestamp': datetime.fromtimestamp(record.created).isoformat(),
            'level': record.levelname,
            'category': getattr(record, 'category', LogCategory.APPLICATION.value),
            'message': record.getMessage(),
            'logger': record.name,
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
            'thread_id': record.thread,
            'process_id': record.process
        }
        
        # Add optional context
        if hasattr(record, 'user_id'):
            log_entry['user_id'] = record.user_id
        if hasattr(record, 'session_id'):
            log_entry['session_id'] = record.session_id
        if hasattr(record, 'request_id'):
            log_entry['request_id'] = record.request_id
        
        # Add exception information
        if record.exc_info:
            log_entry['exception'] = {
                'type': record.exc_info[0].__name__,
                'message': str(record.exc_info[1]),
                'traceback': self.formatException(record.exc_info)
            }
        
        # Add extra fields
        if self.include_extra:
            extra_data = {}
            for key, value in record.__dict__.items():
                if key not in ['name', 'msg', 'args', 'levelname', 'levelno', 'pathname',
                              'filename', 'module', 'lineno', 'funcName', 'created',
                              'msecs', 'relativeCreated', 'thread', 'threadName',
                              'processName', 'process', 'getMessage', 'exc_info',
                              'exc_text', 'stack_info', 'category', 'user_id',
                              'session_id', 'request_id']:
                    extra_data[key] = value
            
            if extra_data:
                log_entry['extra'] = extra_data
        
        return json.dumps(log_entry, default=str)

class LogRotationHandler(logging.handlers.RotatingFileHandler):
    """Enhanced rotating file handler with compression."""
    
    def __init__(self, filename: str, maxBytes: int = 100*1024*1024, 
                 backupCount: int = 10, compress: bool = True):
        super().__init__(filename, maxBytes=maxBytes, backupCount=backupCount)
        self.compress = compress

    def doRollover(self):
        """Perform log rotation with optional compression."""
        super().doRollover()
        
        if self.compress and self.backupCount > 0:
            # Compress the most recent backup
            backup_file = f"{self.baseFilename}.1"
            if os.path.exists(backup_file):
                compressed_file = f"{backup_file}.gz"
                with open(backup_file, 'rb') as f_in:
                    with gzip.open(compressed_file, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
                os.remove(backup_file)

class LogAggregator:
    """Aggregates and analyzes log entries."""
    
    def __init__(self, max_entries: int = 10000):
        self.max_entries = max_entries
        self.log_buffer = deque(maxlen=max_entries)
        self.lock = threading.Lock()
        
        # Analytics data
        self.level_counts = defaultdict(int)
        self.category_counts = defaultdict(int)
        self.logger_counts = defaultdict(int)
        self.error_patterns = defaultdict(int)

    def add_log_entry(self, log_entry: LogEntry):
        """Add a log entry to the aggregator."""
        with self.lock:
            self.log_buffer.append(log_entry)
            
            # Update analytics
            self.level_counts[log_entry.level.name] += 1
            self.category_counts[log_entry.category.value] += 1
            self.logger_counts[log_entry.logger_name] += 1
            
            # Extract error patterns
            if log_entry.level in [LogLevel.ERROR, LogLevel.CRITICAL]:
                self._extract_error_patterns(log_entry.message)

    def _extract_error_patterns(self, message: str):
        """Extract common error patterns from log messages."""
        # Common error patterns
        patterns = [
            r'Connection.*failed',
            r'Timeout.*exceeded',
            r'Permission.*denied',
            r'File.*not found',
            r'Database.*error',
            r'Authentication.*failed',
            r'Invalid.*request',
            r'Memory.*error',
            r'Network.*error'
        ]
        
        for pattern in patterns:
            if re.search(pattern, message, re.IGNORECASE):
                self.error_patterns[pattern] += 1
                break

    def get_analytics(self, time_range: Optional[timedelta] = None) -> LogAnalytics:
        """Get log analytics for a time range."""
        with self.lock:
            if time_range:
                cutoff_time = datetime.now() - time_range
                filtered_logs = [
                    entry for entry in self.log_buffer
                    if entry.timestamp >= cutoff_time
                ]
            else:
                filtered_logs = list(self.log_buffer)
            
            if not filtered_logs:
                return LogAnalytics(
                    total_logs=0,
                    logs_by_level={},
                    logs_by_category={},
                    error_patterns={},
                    top_loggers={},
                    time_range={}
                )
            
            # Calculate analytics
            level_counts = defaultdict(int)
            category_counts = defaultdict(int)
            logger_counts = defaultdict(int)
            
            for entry in filtered_logs:
                level_counts[entry.level.name] += 1
                category_counts[entry.category.value] += 1
                logger_counts[entry.logger_name] += 1
            
            # Get top loggers
            top_loggers = dict(sorted(logger_counts.items(), 
                                    key=lambda x: x[1], reverse=True)[:10])
            
            return LogAnalytics(
                total_logs=len(filtered_logs),
                logs_by_level=dict(level_counts),
                logs_by_category=dict(category_counts),
                error_patterns=dict(self.error_patterns),
                top_loggers=top_loggers,
                time_range={
                    'start': min(entry.timestamp for entry in filtered_logs),
                    'end': max(entry.timestamp for entry in filtered_logs)
                }
            )

    def search_logs(self, query: str, level: Optional[LogLevel] = None,
                   category: Optional[LogCategory] = None,
                   time_range: Optional[timedelta] = None) -> List[LogEntry]:
        """Search logs with filters."""
        with self.lock:
            results = []
            
            for entry in self.log_buffer:
                # Time filter
                if time_range:
                    cutoff_time = datetime.now() - time_range
                    if entry.timestamp < cutoff_time:
                        continue
                
                # Level filter
                if level and entry.level != level:
                    continue
                
                # Category filter
                if category and entry.category != category:
                    continue
                
                # Text search
                if query.lower() in entry.message.lower():
                    results.append(entry)
            
            return results

class ProductionLogger:
    """Main production logging system."""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.log_dir = Path(self.config.get('log_dir', 'logs'))
        self.log_dir.mkdir(exist_ok=True)
        
        # Initialize aggregator
        self.aggregator = LogAggregator(
            max_entries=self.config.get('max_log_entries', 10000)
        )
        
        # Setup loggers
        self.loggers = {}
        self._setup_loggers()
        
        # Setup log forwarding (for centralized logging)
        self._setup_log_forwarding()

    def _setup_loggers(self):
        """Setup different loggers for different categories."""
        log_configs = {
            'application': {
                'filename': 'application.log',
                'level': logging.INFO,
                'format': 'structured'
            },
            'security': {
                'filename': 'security.log',
                'level': logging.WARNING,
                'format': 'structured'
            },
            'performance': {
                'filename': 'performance.log',
                'level': logging.INFO,
                'format': 'structured'
            },
            'ai_inference': {
                'filename': 'ai_inference.log',
                'level': logging.INFO,
                'format': 'structured'
            },
            'database': {
                'filename': 'database.log',
                'level': logging.INFO,
                'format': 'structured'
            },
            'http': {
                'filename': 'http.log',
                'level': logging.INFO,
                'format': 'structured'
            },
            'system': {
                'filename': 'system.log',
                'level': logging.INFO,
                'format': 'structured'
            },
            'audit': {
                'filename': 'audit.log',
                'level': logging.INFO,
                'format': 'structured'
            }
        }
        
        for category, config in log_configs.items():
            logger = logging.getLogger(f"pixelated.{category}")
            logger.setLevel(config['level'])
            
            # File handler with rotation
            file_handler = LogRotationHandler(
                filename=str(self.log_dir / config['filename']),
                maxBytes=self.config.get('max_log_size', 100*1024*1024),
                backupCount=self.config.get('backup_count', 10),
                compress=True
            )
            
            # Structured formatter
            if config['format'] == 'structured':
                formatter = StructuredFormatter()
            else:
                formatter = logging.Formatter(
                    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
                )
            
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)
            
            # Console handler for development
            if self.config.get('console_logging', False):
                console_handler = logging.StreamHandler()
                console_handler.setFormatter(formatter)
                logger.addHandler(console_handler)
            
            # Custom handler to feed aggregator
            aggregator_handler = AggregatorHandler(self.aggregator, category)
            logger.addHandler(aggregator_handler)
            
            self.loggers[category] = logger

    def _setup_log_forwarding(self):
        """Setup log forwarding to external systems."""
        # ELK Stack integration
        elk_config = self.config.get('elk')
        if elk_config:
            self._setup_elk_forwarding(elk_config)
        
        # Syslog integration
        syslog_config = self.config.get('syslog')
        if syslog_config:
            self._setup_syslog_forwarding(syslog_config)

    def _setup_elk_forwarding(self, elk_config: Dict[str, Any]):
        """Setup ELK stack log forwarding."""
        try:
            from logging_handlers import ElasticsearchHandler
            
            for logger in self.loggers.values():
                elk_handler = ElasticsearchHandler(
                    hosts=[elk_config['host']],
                    index=elk_config.get('index', 'pixelated-logs'),
                    doc_type=elk_config.get('doc_type', 'log')
                )
                elk_handler.setFormatter(StructuredFormatter())
                logger.addHandler(elk_handler)
                
        except ImportError:
            logging.warning("Elasticsearch handler not available")

    def _setup_syslog_forwarding(self, syslog_config: Dict[str, Any]):
        """Setup syslog forwarding."""
        try:
            syslog_handler = logging.handlers.SysLogHandler(
                address=(syslog_config['host'], syslog_config.get('port', 514))
            )
            syslog_handler.setFormatter(StructuredFormatter())
            
            for logger in self.loggers.values():
                logger.addHandler(syslog_handler)
                
        except Exception as e:
            logging.warning(f"Failed to setup syslog forwarding: {e}")

    def get_logger(self, category: str) -> logging.Logger:
        """Get logger for a specific category."""
        return self.loggers.get(category, self.loggers['application'])

    def log_application_event(self, level: str, message: str, **kwargs):
        """Log application event."""
        logger = self.get_logger('application')
        getattr(logger, level.lower())(message, extra=kwargs)

    def log_security_event(self, level: str, message: str, user_id: str = None, **kwargs):
        """Log security event."""
        logger = self.get_logger('security')
        extra = {'user_id': user_id, **kwargs}
        getattr(logger, level.lower())(message, extra=extra)

    def log_performance_event(self, message: str, duration: float, **kwargs):
        """Log performance event."""
        logger = self.get_logger('performance')
        extra = {'duration': duration, **kwargs}
        logger.info(message, extra=extra)

    def log_ai_inference(self, model: str, duration: float, status: str, **kwargs):
        """Log AI inference event."""
        logger = self.get_logger('ai_inference')
        extra = {'model': model, 'duration': duration, 'status': status, **kwargs}
        logger.info(f"AI inference completed: {model}", extra=extra)

    def log_http_request(self, method: str, path: str, status_code: int, 
                        duration: float, user_id: str = None, **kwargs):
        """Log HTTP request."""
        logger = self.get_logger('http')
        extra = {
            'method': method,
            'path': path,
            'status_code': status_code,
            'duration': duration,
            'user_id': user_id,
            **kwargs
        }
        logger.info(f"{method} {path} - {status_code}", extra=extra)

    def log_database_operation(self, operation: str, table: str, duration: float, **kwargs):
        """Log database operation."""
        logger = self.get_logger('database')
        extra = {'operation': operation, 'table': table, 'duration': duration, **kwargs}
        logger.info(f"Database {operation} on {table}", extra=extra)

    def log_audit_event(self, action: str, user_id: str, resource: str, **kwargs):
        """Log audit event."""
        logger = self.get_logger('audit')
        extra = {'action': action, 'user_id': user_id, 'resource': resource, **kwargs}
        logger.info(f"Audit: {action} on {resource} by {user_id}", extra=extra)

    def get_log_analytics(self, time_range: Optional[timedelta] = None) -> LogAnalytics:
        """Get log analytics."""
        return self.aggregator.get_analytics(time_range)

    def search_logs(self, query: str, **filters) -> List[LogEntry]:
        """Search logs with filters."""
        return self.aggregator.search_logs(query, **filters)

    def generate_log_report(self, time_range: Optional[timedelta] = None) -> str:
        """Generate comprehensive log report."""
        analytics = self.get_log_analytics(time_range)
        
        report_file = f"log_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        report = {
            'generated_at': datetime.now().isoformat(),
            'time_range': time_range.total_seconds() if time_range else 'all',
            'analytics': asdict(analytics),
            'log_files': {
                category: str(self.log_dir / f"{category}.log")
                for category in self.loggers.keys()
            }
        }
        
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        return report_file

class AggregatorHandler(logging.Handler):
    """Custom handler to feed log aggregator."""
    
    def __init__(self, aggregator: LogAggregator, category: str):
        super().__init__()
        self.aggregator = aggregator
        self.category = LogCategory(category)

    def emit(self, record: logging.LogRecord):
        """Emit log record to aggregator."""
        try:
            log_entry = LogEntry(
                timestamp=datetime.fromtimestamp(record.created),
                level=LogLevel(record.levelno),
                category=self.category,
                message=record.getMessage(),
                logger_name=record.name,
                module=record.module,
                function=record.funcName,
                line_number=record.lineno,
                thread_id=record.thread,
                process_id=record.process,
                user_id=getattr(record, 'user_id', None),
                session_id=getattr(record, 'session_id', None),
                request_id=getattr(record, 'request_id', None),
                extra_data={
                    k: v for k, v in record.__dict__.items()
                    if k not in ['name', 'msg', 'args', 'levelname', 'levelno',
                               'pathname', 'filename', 'module', 'lineno',
                               'funcName', 'created', 'msecs', 'relativeCreated',
                               'thread', 'threadName', 'processName', 'process']
                },
                stack_trace=self.format(record) if record.exc_info else None
            )
            
            self.aggregator.add_log_entry(log_entry)
            
        except Exception:
            self.handleError(record)

def main():
    """Main function for testing the logging system."""
    print("📝 PRODUCTION LOGGING SYSTEM TEST")
    print("=" * 50)
    
    # Initialize logging system
    config = {
        'log_dir': 'test_logs',
        'console_logging': True,
        'max_log_entries': 1000
    }
    
    logger_system = ProductionLogger(config)
    
    # Test different log types
    logger_system.log_application_event('info', 'Application started successfully')
    logger_system.log_security_event('warning', 'Failed login attempt', user_id='user123')
    logger_system.log_performance_event('Database query completed', duration=0.045, query='SELECT * FROM users')
    logger_system.log_ai_inference('gpt-3.5-turbo', duration=1.2, status='success', tokens=150)
    logger_system.log_http_request('GET', '/api/chat', 200, 0.123, user_id='user456')
    logger_system.log_database_operation('SELECT', 'conversations', 0.023, rows_returned=50)
    logger_system.log_audit_event('CREATE', 'admin', 'user_account', target_user='newuser')
    
    print("✅ Logged various event types")
    
    # Get analytics
    analytics = logger_system.get_log_analytics()
    print(f"✅ Total logs: {analytics.total_logs}")
    print(f"✅ Logs by level: {analytics.logs_by_level}")
    print(f"✅ Logs by category: {analytics.logs_by_category}")
    
    # Search logs
    search_results = logger_system.search_logs('login')
    print(f"✅ Search results: {len(search_results)} logs found")
    
    # Generate report
    report_file = logger_system.generate_log_report()
    print(f"✅ Report generated: {report_file}")
    
    print("\n🎉 Production logging system is functional!")

if __name__ == "__main__":
    main()
