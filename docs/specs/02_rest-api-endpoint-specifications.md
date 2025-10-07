## TechDeck-Python Pipeline REST API Endpoint Specifications

### OpenAPI 3.0 Specification for Dataset Pipeline Integration

```yaml
openapi: 3.0.3
info:
  title: TechDeck Dataset Pipeline API
  description: |
    REST API for integrating TechDeck frontend with Python dataset pipeline.
    Provides file upload, format conversion, pipeline orchestration, and quality validation.
  version: 1.0.0
  contact:
    name: Pixelated Empathy Support
    email: support@pixelatedempathy.com
  license:
    name: HIPAA Compliant
    url: https://pixelatedempathy.com/compliance

servers:
  - url: https://api.pixelatedempathy.com/api/v1
    description: Production server
  - url: http://localhost:8000/api/v1
    description: Development server

security:
  - bearerAuth: []

tags:
  - name: datasets
    description: Dataset management operations
  - name: pipeline
    description: Pipeline orchestration and execution
  - name: standardization
    description: Format conversion and standardization
  - name: validation
    description: Quality validation and bias detection
  - name: analytics
    description: Analytics and monitoring
  - name: system
    description: System health and status

paths:
  # Dataset Management Endpoints
  /datasets:
    get:
      tags:
        - datasets
      summary: List all datasets
      description: Retrieve paginated list of datasets with filtering options
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
            minimum: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, processing, completed, error]
        - name: source_type
          in: query
          schema:
            type: string
            enum: [upload, huggingface, kaggle]
      responses:
        '200':
          description: Successfully retrieved datasets
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DatasetListResponse'
        '401':
          $ref: '#/components/responses/UnauthorizedError'
        '429':
          $ref: '#/components/responses/RateLimitError'

    post:
      tags:
        - datasets
      summary: Upload or import dataset
      description: |
        Upload a dataset file or import from URL (HuggingFace/Kaggle).
        Supports CSV, JSON, JSONL, and Parquet formats.
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
                  description: Dataset file to upload
                name:
                  type: string
                  description: Dataset name
                description:
                  type: string
                  description: Dataset description
                source_url:
                  type: string
                  format: uri
                  description: URL for import (HuggingFace/Kaggle)
              oneOf:
                - required: [file]
                - required: [source_url]
      responses:
        '201':
          description: Dataset created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DatasetResponse'
        '400':
          $ref: '#/components/responses/BadRequestError'
        '401':
          $ref: '#/components/responses/UnauthorizedError'
        '413':
          description: File too large
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /datasets/{dataset_id}:
    get:
      tags:
        - datasets
      summary: Get dataset details
      parameters:
        - name: dataset_id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Dataset details retrieved
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DatasetResponse'
        '404':
          $ref: '#/components/responses/NotFoundError'

    delete:
      tags:
        - datasets
      summary: Delete dataset
      parameters:
        - name: dataset_id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '204':
          description: Dataset deleted successfully
        '404':
          $ref: '#/components/responses/NotFoundError'

  /datasets/{dataset_id}/progress:
    get:
      tags:
        - datasets
      summary: Get dataset processing progress
      description: Real-time progress for dataset upload/processing operations
      parameters:
        - name: dataset_id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Progress information retrieved
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProgressResponse'

  /datasets/{dataset_id}/export:
    get:
      tags:
        - datasets
      summary: Export dataset in specified format
      parameters:
        - name: dataset_id
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: format
          in: query
          required: true
          schema:
            type: string
            enum: [json, jsonl, csv, parquet]
        - name: compression
          in: query
          schema:
            type: string
            enum: [none, gzip, zip]
            default: none
      responses:
        '200':
          description: Dataset exported successfully
          content:
            application/json:
              schema:
                type: string
                format: binary
            text/csv:
              schema:
                type: string
                format: binary
            application/jsonl:
              schema:
                type: string
                format: binary
          headers:
            Content-Disposition:
              schema:
                type: string
                example: attachment; filename="dataset_123.json"
        '404':
          $ref: '#/components/responses/NotFoundError'

  # Pipeline Orchestration Endpoints
  /pipeline/execute:
    post:
      tags:
        - pipeline
      summary: Execute dataset pipeline
      description: |
        Start complete pipeline execution with configurable parameters.
        Supports multiple execution modes for different performance requirements.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PipelineExecutionRequest'
      responses:
        '202':
          description: Pipeline execution started
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PipelineExecutionResponse'
        '400':
          $ref: '#/components/responses/BadRequestError'
        '429':
          $ref: '#/components/responses/RateLimitError'

  /pipeline/status/{execution_id}:
    get:
      tags:
        - pipeline
      summary: Get pipeline execution status
      parameters:
        - name: execution_id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Pipeline status retrieved
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PipelineStatusResponse'

  /pipeline/cancel/{execution_id}:
    post:
      tags:
        - pipeline
      summary: Cancel pipeline execution
      parameters:
        - name: execution_id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Pipeline cancelled successfully
        '404':
          $ref: '#/components/responses/NotFoundError'

  # Standardization Endpoints
  /standardization/conversation:
    post:
      tags:
        - standardization
      summary: Standardize single conversation
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ConversationStandardizationRequest'
      responses:
        '200':
          description: Conversation standardized successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/StandardizationResponse'

  /standardization/batch:
    post:
      tags:
        - standardization
      summary: Standardize batch of conversations
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BatchStandardizationRequest'
      responses:
        '202':
          description: Batch standardization started
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BatchStandardizationResponse'

  /standardization/file:
    post:
      tags:
        - standardization
      summary: Standardize conversations from file
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
                target_format:
                  type: string
                  enum: [chatml, alpaca, vicuna, sharegpt]
                  default: chatml
                auto_detect:
                  type: boolean
                  default: true
              required:
                - file
      responses:
        '202':
          description: File standardization started
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/FileStandardizationResponse'

  # Validation Endpoints
  /validation/conversation:
    post:
      tags:
        - validation
      summary: Validate therapeutic conversation
      description: |
        Perform multi-tier validation including DSM-5 accuracy,
        therapeutic appropriateness, and bias detection.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ConversationValidationRequest'
      responses:
        '200':
          description: Conversation validated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ValidationResponse'

  /validation/quality:
    post:
      tags:
        - validation
      summary: Quality scoring and filtering
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/QualityValidationRequest'
      responses:
        '200':
          description: Quality validation completed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/QualityValidationResponse'

  /validation/metrics/{validation_id}:
    get:
      tags:
        - validation
      summary: Get detailed validation metrics
      parameters:
        - name: validation_id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Validation metrics retrieved
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ValidationMetricsResponse'

  # Analytics Endpoints
  /analytics/dashboard:
    get:
      tags:
        - analytics
      summary: Get comprehensive analytics dashboard
      parameters:
        - name: time_range
          in: query
          schema:
            type: string
            enum: [1h, 24h, 7d, 30d]
            default: 24h
        - name: dataset_id
          in: query
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Analytics dashboard data retrieved
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AnalyticsDashboardResponse'

  /analytics/quality:
    get:
      tags:
        - analytics
      summary: Get quality metrics and trends
      parameters:
        - name: time_range
          in: query
          schema:
            type: string
            enum: [1h, 24h, 7d, 30d]
            default: 24h
      responses:
        '200':
          description: Quality metrics retrieved
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/QualityMetricsResponse'

  # System Health Endpoints
  /system/status:
    get:
      tags:
        - system
      summary: Get system health status
      responses:
        '200':
          description: System status retrieved
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemStatusResponse'

  /system/health:
    get:
      tags:
        - system
      summary: Health check endpoint
      responses:
        '200':
          description: Service is healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: healthy
                  timestamp:
                    type: string
                    format: date-time

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT token for API authentication

  schemas:
    # Base Response Schemas
    BaseResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          oneOf:
            - type: object
            - type: array
            - type: string
            - type: number
            - type: boolean
        error:
          $ref: '#/components/schemas/ErrorDetails'
        meta:
          $ref: '#/components/schemas/ResponseMetadata'
      required:
        - success

    ErrorDetails:
      type: object
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: object
        timestamp:
          type: string
          format: date-time

    ResponseMetadata:
      type: object
      properties:
        request_id:
          type: string
          format: uuid
        timestamp:
          type: string
          format: date-time
        processing_time_ms:
          type: number
        pagination:
          $ref: '#/components/schemas/PaginationInfo'

    PaginationInfo:
      type: object
      properties:
        page:
          type: integer
        limit:
          type: integer
        total:
          type: integer
        total_pages:
          type: integer

    # Dataset Schemas
    Dataset:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        description:
          type: string
        source_type:
          type: string
          enum: [upload, huggingface, kaggle]
        source_url:
          type: string
          format: uri
        format:
          type: string
          enum: [csv, json, jsonl, parquet]
        total_rows:
          type: integer
          minimum: 0
        columns:
          type: array
          items:
            type: string
        template_format:
          type: string
          enum: [chatml, alpaca, vicuna, sharegpt, custom]
        status:
          type: string
          enum: [pending, processing, completed, error]
        quality_score:
          type: number
          minimum: 0
          maximum: 1
        bias_score:
          type: number
          minimum: 0
          maximum: 1
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
        metadata:
          type: object

    DatasetResponse:
      allOf:
        - $ref: '#/components/schemas/BaseResponse'
        - type: object
          properties:
            data:
              $ref: '#/components/schemas/Dataset'

    DatasetListResponse:
      allOf:
        - $ref: '#/components/schemas/BaseResponse'
        - type: object
          properties:
            data:
              type: object
              properties:
                datasets:
                  type: array
                  items:
                    $ref: '#/components/schemas/Dataset'
                pagination:
                  $ref: '#/components/schemas/PaginationInfo'

    # Progress Schemas
    ProgressResponse:
      allOf:
        - $ref: '#/components/schemas/BaseResponse'
        - type: object
          properties:
            data:
              type: object
              properties:
                progress:
                  type: number
                  minimum: 0
                  maximum: 100
                status:
                  type: string
                  enum: [pending, uploading, processing, completed, error]
                stage:
                  type: string
                message:
                  type: string
                estimated_time_remaining:
                  type: integer
                  description: Estimated seconds remaining
                current_operation:
                  type: string
                bytes_processed:
                  type: integer
                total_bytes:
                  type: integer

    # Pipeline Schemas
    PipelineExecutionRequest:
      type: object
      properties:
        dataset_ids:
          type: array
          items:
            type: string
            format: uuid
          minItems: 1
        execution_mode:
          type: string
          enum: [sequential, concurrent, adaptive, priority_based]
          default: adaptive
        quality_threshold:
          type: number
          minimum: 0
          maximum: 1
          default: 0.7
        enable_bias_detection:
          type: boolean
          default: true
        enable_deduplication:
          type: boolean
          default: true
        enable_validation:
          type: boolean
          default: true
        metadata:
          type: object
      required:
        - dataset_ids

    PipelineExecutionResponse:
      allOf:
        - $ref: '#/components/schemas/BaseResponse'
        - type: object
          properties:
            data:
              type: object
              properties:
                execution_id:
                  type: string
                  format: uuid
                status:
                  type: string
                  enum: [queued, running, completed, failed, cancelled]
                estimated_duration:
                  type: integer
                  description: Estimated duration in seconds

    PipelineStatusResponse:
      allOf:
        - $ref: '#/components/schemas/BaseResponse'
        - type: object
          properties:
            data:
              type: object
              properties:
                execution_id:
                  type: string
                  format: uuid
                status:
                  type: string
                  enum: [queued, running, completed, failed, cancelled]
                progress:
                  type: number
                  minimum: 0
                  maximum: 100
                current_stage:
                  type: string
                stages_completed:
                  type: array
                  items:
                    type: string
                stages_remaining:
                  type: array
                  items:
                    type: string
                start_time:
                  type: string
                  format: date-time
                end_time:
                  type: string
                  format: date-time
                estimated_completion:
                  type: string
                  format: date-time
                metrics:
                  type: object
                  properties:
                    conversations_processed:
                      type: integer
                    quality_score:
                      type: number
                    bias_score:
                      type: number
                    processing_rate:
                      type: number
                      description: Conversations per second

    # Standardization Schemas
    ConversationStandardizationRequest:
      type: object
      properties:
        conversation:
          type: object
        source_format:
          type: string
          enum: [auto-detect, chatml, alpaca, vicuna, sharegpt]
          default: auto-detect
        target_format:
          type: string
          enum: [chatml, alpaca, vicuna, sharegpt, custom]
          default: chatml
        validate_quality:
          type: boolean
          default: true
      required:
        - conversation

    BatchStandardizationRequest:
      type: object
      properties:
        dataset_id:
          type: string
          format: uuid
        source_format:
          type: string
          enum: [auto-detect, chatml, alpaca, vicuna, sharegpt]
          default: auto-detect
        target_format:
          type: string
          enum: [chatml, alpaca, vicuna, sharegpt, custom]
          default: chatml
        batch_size:
          type: integer
          minimum: 1
          maximum: 1000
          default: 100
        enable_validation:
          type: boolean
          default: true
      required:
        - dataset_id

    StandardizationResponse:
      allOf:
        - $ref: '#/components/schemas/BaseResponse'
        - type: object
          properties:
            data:
              type: object
              properties:
                standardized_conversation:
                  type: object
                quality_score:
                  type: number
                format_detected:
                  type: string
                validation_results:
                  type: object

    BatchStandardizationResponse:
      allOf:
        - $ref: '#/components/schemas/BaseResponse'
        - type: object
          properties:
            data:
              type: object
              properties:
                batch_id:
                  type: string
                  format: uuid
                status:
                  type: string
                  enum: [queued, processing, completed, failed]
                total_conversations:
                  type: integer
                processed_conversations:
                  type: integer
                estimated_completion:
                  type: string
                  format: date-time

    FileStandardizationResponse:
      allOf:
        - $ref: '#/components/schemas/BatchStandardizationResponse'

    # Validation Schemas
    ConversationValidationRequest:
      type: object
      properties:
        conversation:
          type: object
        validation_types:
          type: array
          items:
            type: string
            enum: [dsm5_accuracy, therapeutic_appropriateness, bias_detection, privacy_compliance]
          default: [dsm5_accuracy, therapeutic_appropriateness, bias_detection]
        quality_threshold:
          type: number
          minimum: 0
          maximum: 1
          default: 0.7
      required:
        - conversation

    QualityValidationRequest:
      type: object
      properties:
        dataset_id:
          type: string
          format: uuid
        validation_types:
          type: array
          items:
            type: string
            enum: [completeness, consistency, accuracy, bias, privacy]
          default: [completeness, consistency, accuracy, bias]
        sample_size:
          type: integer
          minimum: 1
          maximum: 10000
          default: 1000
      required:
        - dataset_id

    ValidationResponse:
      allOf:
        - $ref: '#/components/schemas/BaseResponse'
        - type: object
          properties:
            data:
              type: object
              properties:
                validation_id:
                  type: string
                  format: uuid
                overall_score:
                  type: number
                  minimum: 0
                  maximum: 1
                validation_results:
                  type: object
                recommendations:
                  type: array
                  items:
                    type: string
                bias_report:
                  $ref: '#/components/schemas/BiasReport'

    QualityValidationResponse:
      allOf:
        - $ref: '#/components/schemas/BaseResponse'
        - type: object
          properties:
            data:
              type: object
              properties:
                quality_score:
                  type: number
                  minimum: 0
                  maximum: 1
                total_conversations:
                  type: integer
                valid_conversations:
                  type: integer
                invalid_conversations:
                  type: integer
                quality_distribution:
                  type: object
                recommendations:
                  type: array
                  items:
                    type: string

    ValidationMetricsResponse:
      type: object
      properties:
        validation_id:
          type: string
          format: uuid
        metrics:
          type: object
        quality_trends:
          type: array
          items:
            type: object
        bias_trends:
          type: array
          items:
            type: object

    BiasReport:
      type: object
      properties:
        overall_bias_score:
          type: number
          minimum: 0
          maximum: 1
        demographic_bias:
          type: object
        content_bias:
          type: object
        recommendations:
          type: array
          items:
            type: string
        compliant:
          type: boolean

    # Analytics Schemas
    AnalyticsDashboardResponse:
      allOf:
        - $ref: '#/components/schemas/BaseResponse'
        - type: object
          properties:
            data:
              type: object
              properties:
                overview:
                  type: object
                  properties:
                    total_datasets:
                      type: integer
                    total_conversations:
                      type: integer
                    average_quality_score:
                      type: number
                    average_bias_score:
                      type: number
                recent_activity:
                  type: array
                  items:
                    type: object
                quality_distribution:
                  type: object
                processing_stats:
                  type: object
                system_health:
                  type: object

    QualityMetricsResponse:
      allOf:
        - $ref: '#/components/schemas/BaseResponse'
        - type: object
          properties:
            data:
              type: object
              properties:
                time_range:
                  type: string
                quality_scores:
                  type: array
                  items:
                    type: object
                bias_scores:
                  type: array
                  items:
                    type: object
                trends:
                  type: object

    # System Status Schemas
    SystemStatusResponse:
      allOf:
        - $ref: '#/components/schemas/BaseResponse'
        - type: object
          properties:
            data:
              type: object
              properties:
                status:
                  type: string
                  enum: [healthy, degraded, unhealthy]
                components:
                  type: object
                  properties:
                    pipeline_service:
                      type: object
                      properties:
                        status:
                          type: string
                        response_time:
                          type: number
                        last_check:
                          type: string
                          format: date-time
                    bias_detection:
                      type: object
                      properties:
                        status:
                          type: string
                        response_time:
                          type: number
                        last_check:
                          type: string
                          format: date-time
                    database:
                      type: object
                      properties:
                        status:
                          type: string
                        connection_pool:
                          type: integer
                        last_check:
                          type: string
                          format: date-time
                metrics:
                  type: object
                  properties:
                    uptime:
                      type: number
                    total_requests:
                      type: integer
                    error_rate:
                      type: number
                    average_response_time:
                      type: number

    # Error Response Schemas
    ErrorResponse:
      allOf:
        - $ref: '#/components/schemas/BaseResponse'
        - type: object
          properties:
            success:
              type: boolean
              enum: [false]
            error:
              type: object
              properties:
                code:
                  type: string
                  enum: [BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, RATE_LIMITED, INTERNAL_ERROR, SERVICE_UNAVAILABLE]
                message:
                  type string
                details:
                  type: object
                timestamp:
                  type: string
                  format: date-time
                request_id:
                  type: string
                  format: uuid

  responses:
    BadRequestError:
      description: Bad request - invalid parameters
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            success: false
            error:
              code: BAD_REQUEST
              message: Invalid request parameters
              details:
                field: "name is required"
              timestamp: "2024-01-01T12:00:00Z"
              request_id: "123e4567-e89b-12d3-a456-426614174000"

    UnauthorizedError:
      description: Unauthorized - invalid or missing authentication
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            success: false
            error:
              code: UNAUTHORIZED
              message: Invalid or expired authentication token
              timestamp: "2024-01-01T12:00:00Z"
              request_id: "123e4567-e89b-12d3-a456-426614174000"

    NotFoundError:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            success: false
            error:
              code: NOT_FOUND
              message: Dataset not found
              timestamp: "2024-01-01T12:00:00Z"
              request_id: "123e4567-e89b-12d3-a456-426614174000"

    RateLimitError:
      description: Rate limit exceeded
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            success: false
            error:
              code: RATE_LIMITED
              message: Rate limit exceeded. Please try again later.
              details:
                retry_after: 60
                limit: 100
                window: "1 minute"
              timestamp: "2024-01-01T12:00:00Z"
              request_id: "123e4567-e89b-12d3-a456-426614174000"
```

### Key API Design Principles

1. **RESTful Design**: Follow REST conventions with proper HTTP methods and status codes
2. **Consistent Error Handling**: Standardized error response format across all endpoints
3. **Pagination**: Support for paginated responses on list endpoints
4. **Rate Limiting**: Built-in rate limiting with clear headers and retry guidance
5. **HIPAA Compliance**: All endpoints include proper authentication and audit logging
6. **Real-time Updates**: WebSocket support for progress tracking with polling fallback
7. **File Handling**: Secure file upload with size limits and format validation
8. **Progress Tracking**: Consistent progress response format for long-running operations
9. **Bias Detection**: Integrated bias detection in all validation and processing endpoints
10. **Performance Monitoring**: Built-in metrics and performance tracking

### Authentication & Security

- **Bearer Token Authentication**: JWT-based authentication for all endpoints
- **Rate Limiting**: 
  - 100 requests/minute for validation operations
  - 10 exports/hour for dataset exports
  - 5 pipeline executions/hour per user
- **HIPAA++ Compliance**: All data handling exceeds standard HIPAA requirements
- **Audit Logging**: Complete audit trail for all operations
- **Input Validation**: Comprehensive validation for all request parameters
- **File Security**: Secure file handling with virus scanning and encryption

### Performance Targets

- **Response Time**: 95% of requests complete within 2 seconds
- **Upload Performance**: 10MB files upload within 30 seconds
- **Pipeline Throughput**: Process 100+ conversations/second
- **Concurrent Users**: Support 50+ simultaneous users
- **Error Rate**: Less than 1% failure rate for standard operations

### Integration with Existing TechDeck Components

The API endpoints are designed to seamlessly integrate with existing TechDeck React components:

1. **UploadSection** → `/datasets` POST endpoint with multipart form data
2. **ConversionPanel** → `/standardization/conversation` and `/standardization/batch` endpoints
3. **DatasetPreview** → `/datasets/{id}` and `/validation/quality` endpoints
4. **Progress Indicators** → `/datasets/{id}/progress` and `/pipeline/status/{id}` endpoints
5. **Export Functionality** → `/datasets/{id}/export` endpoint

### Error Handling Strategy

- **Client-Side Validation**: Immediate feedback for invalid inputs
- **Server-Side Validation**: Comprehensive validation with detailed error messages
- **Graceful Degradation**: System remains functional when individual services fail
- **Retry Mechanisms**: Automatic retry with exponential backoff for transient failures
- **Monitoring Integration**: All errors reported to existing monitoring systems

This API specification provides a comprehensive foundation for integrating the TechDeck frontend with the Python dataset pipeline while maintaining HIPAA compliance and enterprise-grade reliability.