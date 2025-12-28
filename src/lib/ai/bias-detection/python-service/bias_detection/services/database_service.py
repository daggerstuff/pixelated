"""
Database service for PostgreSQL and MongoDB integration
"""

import json
from typing import Any, Dict, List, Optional

import asyncpg
import structlog
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from tenacity import stop_after_attempt, wait_exponential, retry

from ..config import settings
from ..models import BiasAnalysisResponse

logger = structlog.get_logger(__name__)


class DatabaseService:
    """Database service for PostgreSQL and MongoDB operations"""

    def __init__(self):
        self.pg_pool: Optional[asyncpg.Pool] = None
        self.async_engine = None
        self.async_session = None
        self.is_connected = False

    async def connect(self) -> bool:
        """Connect to databases"""
        try:
            logger.info("Connecting to databases")

            # Connect to PostgreSQL
            pg_connected = await self._connect_postgresql()
            if not pg_connected:
                return False

            # Initialize database schema
            await self._initialize_schema()

            self.is_connected = True
            logger.info("Database connections established successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to databases: {str(e)}", error=str(e))
            return False

    async def disconnect(self) -> None:
        """Disconnect from databases"""
        try:
            logger.info("Disconnecting from databases")

            # Close PostgreSQL pool
            if self.pg_pool:
                await self.pg_pool.close()
                self.pg_pool = None

            self.is_connected = False
            logger.info("Database connections closed")

        except Exception as e:
            logger.error(f"Error during database disconnect: {str(e)}", error=str(e))

    async def _connect_postgresql(self) -> bool:
        """Connect to PostgreSQL"""
        try:
            # Create connection pool
            self.pg_pool = await asyncpg.create_pool(
                str(settings.database_url),
                min_size=5,
                max_size=20,
                command_timeout=30,
                server_settings={
                    "application_name": "bias_detection_service",
                    "jit": "off",  # Disable JIT for better performance
                },
            )

            # Test connection
            async with self.pg_pool.acquire() as conn:
                await conn.execute("SELECT 1")

            # Create SQLAlchemy async engine for ORM operations
            self.async_engine = create_async_engine(
                str(settings.database_url),
                pool_size=10,
                max_overflow=20,
                pool_pre_ping=True,
                pool_recycle=3600,
            )

            self.async_session = sessionmaker(
                self.async_engine, class_=AsyncSession, expire_on_commit=False
            )

            logger.info("PostgreSQL connection established")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {str(e)}", error=str(e))
            return False

    async def _initialize_schema(self) -> None:
        """Initialize database schema"""
        try:
            logger.info("Initializing database schema")

            schema_sql = """
            -- Bias analysis results table
            CREATE TABLE IF NOT EXISTS bias_analyses (
                id UUID PRIMARY KEY,
                request_id VARCHAR(255) NOT NULL,
                content_hash VARCHAR(64) NOT NULL,
                content TEXT NOT NULL,
                content_type VARCHAR(50),
                language VARCHAR(10),
                context TEXT,
                user_id VARCHAR(255),
                session_id VARCHAR(255),
                overall_bias_score FLOAT NOT NULL,
                bias_types_detected JSONB,
                sentiment_analysis JSONB,
                keyword_analysis JSONB,
                contextual_analysis JSONB,
                recommendations JSONB,
                counterfactual_scenarios JSONB,
                processing_time_ms INTEGER,
                model_version VARCHAR(50),
                language_detected VARCHAR(10),
                word_count INTEGER,
                status VARCHAR(50) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                completed_at TIMESTAMP WITH TIME ZONE,
                INDEX idx_request_id (request_id),
                INDEX idx_content_hash (content_hash),
                INDEX idx_user_id (user_id),
                INDEX idx_created_at (created_at),
                INDEX idx_status (status)
            );

            -- Bias scores table (for detailed analysis)
            CREATE TABLE IF NOT EXISTS bias_scores (
                id UUID PRIMARY KEY,
                analysis_id UUID REFERENCES bias_analyses(id),
                bias_type VARCHAR(50) NOT NULL,
                score FLOAT NOT NULL,
                confidence FLOAT NOT NULL,
                confidence_level VARCHAR(20),
                evidence JSONB,
                explanation TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                INDEX idx_analysis_id (analysis_id),
                INDEX idx_bias_type (bias_type),
                INDEX idx_score (score)
            );

            -- User sessions table
            CREATE TABLE IF NOT EXISTS user_sessions (
                id UUID PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                session_id VARCHAR(255) NOT NULL UNIQUE,
                ip_address INET,
                user_agent TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                INDEX idx_user_id (user_id),
                INDEX idx_session_id (session_id),
                INDEX idx_last_activity (last_activity)
            );

            -- API usage tracking
            CREATE TABLE IF NOT EXISTS api_usage (
                id UUID PRIMARY KEY,
                user_id VARCHAR(255),
                session_id VARCHAR(255),
                endpoint VARCHAR(255) NOT NULL,
                method VARCHAR(10) NOT NULL,
                status_code INTEGER,
                response_time_ms INTEGER,
                request_size_bytes INTEGER,
                response_size_bytes INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                INDEX idx_user_id (user_id),
                INDEX idx_endpoint (endpoint),
                INDEX idx_created_at (created_at),
                INDEX idx_status_code (status_code)
            );

            -- Model performance metrics
            CREATE TABLE IF NOT EXISTS model_metrics (
                id UUID PRIMARY KEY,
                model_name VARCHAR(100) NOT NULL,
                model_version VARCHAR(50),
                prediction_count BIGINT DEFAULT 0,
                avg_processing_time_ms FLOAT,
                accuracy_score FLOAT,
                error_count BIGINT DEFAULT 0,
                last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                INDEX idx_model_name (model_name),
                INDEX idx_last_updated (last_updated)
            );

            -- System configuration
            CREATE TABLE IF NOT EXISTS system_config (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT NOT NULL,
                description TEXT,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_by VARCHAR(255)
            );

            -- Insert default configuration
            INSERT INTO system_config (key, value, description) VALUES
            ('max_sequence_length', '512', 'Maximum sequence length for model input'),
            ('batch_size', '32', 'Batch size for model inference'),
            ('cache_ttl_seconds', '900', 'Cache TTL in seconds'),
            ('rate_limit_per_minute', '60', 'API rate limit per minute'),
            ('enable_caching', 'true', 'Enable result caching'),
            ('enable_async_processing', 'true', 'Enable async processing')
            ON CONFLICT (key) DO NOTHING;
            """

            async with self.pg_pool.acquire() as conn:
                await conn.execute(schema_sql)

            logger.info("Database schema initialized successfully")

        except Exception as e:
            logger.error(
                f"Failed to initialize database schema: {str(e)}", error=str(e)
            )
            raise

    @retry(
        stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def store_analysis(self, analysis: BiasAnalysisResponse) -> bool:
        """Store bias analysis result"""
        try:
            logger.info(
                "Storing analysis result",
                analysis_id=str(analysis.id),
                request_id=analysis.request_id,
            )

            # Store main analysis
            async with self.pg_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO bias_analyses (
                        id, request_id, content_hash, content, content_type, language,
                        context, user_id, session_id, overall_bias_score, bias_types_detected,
                        sentiment_analysis, keyword_analysis, contextual_analysis,
                        recommendations, counterfactual_scenarios, processing_time_ms,
                        model_version, language_detected, word_count, status, completed_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                        $15, $16, $17, $18, $19, $20, $21, $22
                    )
                    """,
                    analysis.id,
                    analysis.request_id,
                    analysis.content_hash,
                    "",  # Content stored separately for privacy
                    "",  # Content type
                    "",  # Language
                    "",  # Context
                    analysis.request_id,  # User ID placeholder
                    analysis.request_id,  # Session ID placeholder
                    analysis.overall_bias_score,
                    json.dumps([bt.value for bt in analysis.bias_scores]),
                    json.dumps(analysis.sentiment_analysis or {}),
                    json.dumps(analysis.keyword_analysis or {}),
                    json.dumps(analysis.contextual_analysis or {}),
                    json.dumps([rec.dict() for rec in analysis.recommendations]),
                    json.dumps([cf.dict() for cf in analysis.counterfactual_scenarios]),
                    analysis.processing_time_ms,
                    analysis.model_version,
                    analysis.language_detected,
                    analysis.word_count,
                    analysis.status.value,
                    analysis.completed_at,
                )

                # Store individual bias scores
                for bias_score in analysis.bias_scores:
                    await conn.execute(
                        """
                        INSERT INTO bias_scores (
                            id, analysis_id, bias_type, score, confidence,
                            confidence_level, evidence, explanation
                        ) VALUES (
                            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7
                        )
                        """,
                        analysis.id,
                        bias_score.bias_type.value,
                        bias_score.score,
                        bias_score.confidence,
                        bias_score.confidence_level.value,
                        json.dumps(bias_score.evidence),
                        bias_score.explanation,
                    )

            logger.info(
                "Analysis result stored successfully", analysis_id=str(analysis.id)
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to store analysis result: {str(e)}",
                analysis_id=str(analysis.id),
                error=str(e),
            )
            return False

    async def get_analysis_by_id(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Get analysis by ID"""
        try:
            async with self.pg_pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT * FROM bias_analyses WHERE id = $1", analysis_id
                )

                if row:
                    return dict(row)

                return None

        except Exception as e:
            logger.error(
                f"Failed to get analysis by ID: {str(e)}",
                analysis_id=analysis_id,
                error=str(e),
            )
            return None

    async def get_analysis_by_request_id(
        self, request_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get analysis by request ID"""
        try:
            async with self.pg_pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT * FROM bias_analyses WHERE request_id = $1", request_id
                )

                if row:
                    return dict(row)

                return None

        except Exception as e:
            logger.error(
                f"Failed to get analysis by request ID: {str(e)}",
                request_id=request_id,
                error=str(e),
            )
            return None

    async def get_user_analyses(
        self, user_id: str, limit: int = 100, offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get analyses for a user"""
        try:
            async with self.pg_pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT * FROM bias_analyses
                    WHERE user_id = $1
                    ORDER BY created_at DESC
                    LIMIT $2 OFFSET $3
                    """,
                    user_id,
                    limit,
                    offset,
                )

                return [dict(row) for row in rows]

        except Exception as e:
            logger.error(
                f"Failed to get user analyses: {str(e)}", user_id=user_id, error=str(e)
            )
            return []

    async def get_analytics_summary(self, days: int = 30) -> Dict[str, Any]:
        """Get analytics summary for the last N days"""
        try:
            async with self.pg_pool.acquire() as conn:
                # Total analyses
                total_analyses = await conn.fetchval(
                    """
                    SELECT COUNT(*) FROM bias_analyses
                    WHERE created_at >= NOW() - INTERVAL '%s days'
                    """,
                    days,
                )

                # Average bias score
                avg_bias_score = await conn.fetchval(
                    """
                    SELECT AVG(overall_bias_score) FROM bias_analyses
                    WHERE created_at >= NOW() - INTERVAL '%s days'
                    """,
                    days,
                )

                # Bias type distribution
                bias_distribution = await conn.fetch(
                    """
                    SELECT bias_type, COUNT(*) as count
                    FROM bias_scores bs
                    JOIN bias_analyses ba ON bs.analysis_id = ba.id
                    WHERE ba.created_at >= NOW() - INTERVAL '%s days'
                    GROUP BY bias_type
                    ORDER BY count DESC
                    """,
                    days,
                )

                # Processing time statistics
                processing_stats = await conn.fetchrow(
                    """
                    SELECT
                        AVG(processing_time_ms) as avg_time,
                        MIN(processing_time_ms) as min_time,
                        MAX(processing_time_ms) as max_time
                    FROM bias_analyses
                    WHERE created_at >= NOW() - INTERVAL '%s days'
                    """,
                    days,
                )

                return {
                    "total_analyses": total_analyses or 0,
                    "avg_bias_score": float(avg_bias_score or 0),
                    "bias_distribution": [
                        {"bias_type": row["bias_type"], "count": row["count"]}
                        for row in bias_distribution
                    ],
                    "processing_stats": (
                        dict(processing_stats) if processing_stats else {}
                    ),
                    "time_period_days": days,
                }

        except Exception as e:
            logger.error(
                f"Failed to get analytics summary: {str(e)}", days=days, error=str(e)
            )
            return {}

    async def track_api_usage(
        self,
        user_id: Optional[str],
        session_id: Optional[str],
        endpoint: str,
        method: str,
        status_code: int,
        response_time_ms: int,
        request_size_bytes: int = 0,
        response_size_bytes: int = 0,
    ) -> bool:
        """Track API usage"""
        try:
            async with self.pg_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO api_usage (
                        user_id, session_id, endpoint, method, status_code,
                        response_time_ms, request_size_bytes, response_size_bytes
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    """,
                    user_id,
                    session_id,
                    endpoint,
                    method,
                    status_code,
                    response_time_ms,
                    request_size_bytes,
                    response_size_bytes,
                )

            return True

        except Exception as e:
            logger.error(
                f"Failed to track API usage: {str(e)}", endpoint=endpoint, error=str(e)
            )
            return False

    async def update_model_metrics(
        self,
        model_name: str,
        model_version: str,
        prediction_count: int = 1,
        processing_time_ms: Optional[int] = None,
        accuracy_score: Optional[float] = None,
        error_count: int = 0,
    ) -> bool:
        """Update model performance metrics"""
        try:
            async with self.pg_pool.acquire() as conn:
                # Get current metrics
                current_metrics = await conn.fetchrow(
                    "SELECT * FROM model_metrics WHERE model_name = $1", model_name
                )

                if current_metrics:
                    # Update existing metrics
                    new_prediction_count = (
                        current_metrics["prediction_count"] + prediction_count
                    )
                    new_error_count = current_metrics["error_count"] + error_count

                    # Calculate new average processing time
                    if processing_time_ms and current_metrics["avg_processing_time_ms"]:
                        total_time = (
                            current_metrics["avg_processing_time_ms"]
                            * current_metrics["prediction_count"]
                        )
                        new_avg_time = (
                            total_time + processing_time_ms
                        ) / new_prediction_count
                    elif processing_time_ms:
                        new_avg_time = processing_time_ms
                    else:
                        new_avg_time = current_metrics["avg_processing_time_ms"]

                    # Update accuracy if provided
                    new_accuracy = (
                        accuracy_score
                        if accuracy_score
                        else current_metrics["accuracy_score"]
                    )

                    await conn.execute(
                        """
                        UPDATE model_metrics
                        SET prediction_count = $1,
                            avg_processing_time_ms = $2,
                            accuracy_score = $3,
                            error_count = $4,
                            last_updated = NOW()
                        WHERE model_name = $5
                        """,
                        new_prediction_count,
                        new_avg_time,
                        new_accuracy,
                        new_error_count,
                        model_name,
                    )
                else:
                    # Insert new metrics
                    await conn.execute(
                        """
                        INSERT INTO model_metrics (
                            id, model_name, model_version, prediction_count,
                            avg_processing_time_ms, accuracy_score, error_count
                        ) VALUES (
                            gen_random_uuid(), $1, $2, $3, $4, $5, $6
                        )
                        """,
                        model_name,
                        model_version,
                        prediction_count,
                        processing_time_ms,
                        accuracy_score,
                        error_count,
                    )

            return True

        except Exception as e:
            logger.error(
                f"Failed to update model metrics: {str(e)}",
                model_name=model_name,
                error=str(e),
            )
            return False

    async def get_model_metrics(self, model_name: str) -> Optional[Dict[str, Any]]:
        """Get model performance metrics"""
        try:
            async with self.pg_pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT * FROM model_metrics WHERE model_name = $1", model_name
                )

                if row:
                    return dict(row)

                return None

        except Exception as e:
            logger.error(
                f"Failed to get model metrics: {str(e)}",
                model_name=model_name,
                error=str(e),
            )
            return None

    async def get_health_status(self) -> Dict[str, Any]:
        """Get database service health status"""
        if not self.is_connected:
            return {
                "status": "unhealthy",
                "connected": False,
                "error": "Not connected to database",
            }

        try:
            async with self.pg_pool.acquire() as conn:
                # Test basic query
                result = await conn.fetchrow("SELECT 1 as test")

                if result and result["test"] == 1:
                    # Get connection pool stats
                    pool_stats = {
                        "size": self.pg_pool.get_size(),
                        "max_size": self.pg_pool.get_max_size(),
                        "idle_connections": self.pg_pool.get_idle_size(),
                    }

                    return {
                        "status": "healthy",
                        "connected": True,
                        "pool_stats": pool_stats,
                    }
                else:
                    return {
                        "status": "degraded",
                        "connected": True,
                        "error": "Test query failed",
                    }

        except Exception as e:
            return {"status": "unhealthy", "connected": True, "error": str(e)}


# Global database service instance
database_service: DatabaseService = DatabaseService()


async def initialize_database() -> bool:
    """Initialize database service"""
    return await database_service.connect()


async def shutdown_database() -> None:
    """Shutdown database service"""
    await database_service.disconnect()
