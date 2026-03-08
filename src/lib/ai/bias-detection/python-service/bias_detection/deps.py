"""
Shared service instances and FastAPI dependency getters.
Set in create_app() before including routers.
"""

from typing import cast

from .services import BiasDetectionService, DatabaseService, database_service
from .services.analysis_orchestrator import AnalysisOrchestrator

# Populated in create_app()
bias_detection_service: BiasDetectionService = BiasDetectionService()
database_service_instance: DatabaseService = cast(DatabaseService, database_service)
analysis_orchestrator: AnalysisOrchestrator = AnalysisOrchestrator(
    bias_detection_service, database_service_instance
)


def get_bias_service() -> BiasDetectionService:
    return bias_detection_service


def get_database_service() -> DatabaseService:
    return database_service_instance


def get_analysis_orchestrator() -> AnalysisOrchestrator:
    return analysis_orchestrator
