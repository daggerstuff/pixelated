## TechDeck-Python Pipeline Testing Strategy & Validation Criteria

### Comprehensive Testing Framework for Enterprise-Grade Integration

This specification defines the complete testing strategy and validation criteria for the TechDeck-Python pipeline integration, ensuring HIPAA++ compliance, performance requirements, and enterprise-grade reliability.

---

## Testing Architecture Overview

### Multi-Layer Testing Framework

```
tests/techdeck_python_integration/
├── unit/                    # Unit tests for individual components
│   ├── test_auth.py        # Authentication tests
│   ├── test_data_transform.py # Data transformation tests
│   ├── test_error_handling.py # Error handling tests
│   ├── test_pipeline.py    # Pipeline execution tests
│   └── test_websocket.py   # WebSocket communication tests
├── integration/            # Integration tests
│   ├── test_api_integration.py # API endpoint integration
│   ├── test_pipeline_integration.py # Pipeline integration
│   ├── test_security_integration.py # Security integration
│   └── test_websocket_integration.py # WebSocket integration
├── e2e/                    # End-to-end tests
│   ├── test_user_journey.py # Complete user workflows
│   ├── test_hipaa_compliance.py # HIPAA compliance validation
│   ├── test_performance.py # Performance benchmarks
│   └── test_bias_detection.py # Bias detection validation
├── performance/            # Performance and load tests
│   ├── test_load_pipeline.py # Pipeline load testing
│   ├── test_stress_upload.py # Upload stress testing
│   └── test_concurrent_users.py # Concurrent user testing
├── security/               # Security-focused tests
│   ├── test_authentication.py # Authentication security
│   ├── test_authorization.py # Authorization security
│   ├── test_data_encryption.py # Data encryption validation
│   └── test_hipaa_compliance.py # HIPAA compliance security
└── fixtures/               # Test data and fixtures
    ├── sample_datasets/    # Sample dataset files
    ├── mock_responses/     # Mock API responses
    └── test_configurations/ # Test configuration files
```

---

## Unit Testing Strategy

### Component-Level Testing with TDD Anchors

```python
# tests/unit/test_pipeline.py - Unit tests for pipeline components
class TestPipelineOrchestrator:
    """Unit tests for PipelineOrchestrator with TDD anchors"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.config = TestConfig()
        self.pipeline_orchestrator = PipelineOrchestrator(self.config)
        self.mock_data_standardizer = MockDataStandardizer()
        self.mock_bias_detector = MockBiasDetector()
    
    @pytest.mark.asyncio
    async def test_pipeline_initialization(self):
        """Test pipeline orchestrator initialization"""
        
        // TEST: Pipeline orchestrator creates successfully with valid config
        orchestrator = PipelineOrchestrator(self.config)
        assert orchestrator is not None
        assert orchestrator.config == self.config
        
        // TEST: Pipeline orchestrator raises error with invalid config
        with pytest.raises(ConfigurationError):
            PipelineOrchestrator(None)
    
    @pytest.mark.asyncio
    async def test_pipeline_execution_success(self):
        """Test successful pipeline execution"""
        
        // TEST: Pipeline executes successfully with valid dataset
        dataset_id = "test_dataset_123"
        pipeline_config = {
            'steps': ['validate', 'standardize', 'analyze'],
            'output_format': 'json'
        }
        
        result = await self.pipeline_orchestrator.execute_pipeline(
            dataset_id, pipeline_config
        )
        
        assert result['status'] == 'completed'
        assert result['dataset_id'] == dataset_id
        assert 'results' in result
        
        // TEST: Pipeline progress updates are generated
        progress_updates = result.get('progress_updates', [])
        assert len(progress_updates) > 0
        assert all(update['progress_percentage'] >= 0 for update in progress_updates)
    
    @pytest.mark.asyncio
    async def test_pipeline_validation_failure(self):
        """Test pipeline handling of validation failures"""
        
        // TEST: Pipeline fails gracefully with invalid dataset
        invalid_dataset_id = "invalid_dataset_456"
        
        with pytest.raises(ValidationError) as exc_info:
            await self.pipeline_orchestrator.execute_pipeline(
                invalid_dataset_id, {}
            )
        
        assert exc_info.value.error_code == 'VALIDATION_ERROR'
        assert 'dataset' in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_pipeline_bias_detection_integration(self):
        """Test pipeline integration with bias detection"""
        
        // TEST: Pipeline includes bias detection in analysis step
        dataset_id = "test_dataset_789"
        pipeline_config = {
            'steps': ['validate', 'bias_check', 'analyze'],
            'bias_threshold': 0.7
        }
        
        result = await self.pipeline_orchestrator.execute_pipeline(
            dataset_id, pipeline_config
        )
        
        assert result['status'] == 'completed'
        assert 'bias_report' in result['results']
        assert 'bias_score' in result['results']['bias_report']
        
        // TEST: Pipeline fails when bias exceeds threshold
        high_bias_config = {
            'steps': ['validate', 'bias_check'],
            'bias_threshold': 0.1  # Very low threshold
        }
        
        with pytest.raises(BiasDetectionError):
            await self.pipeline_orchestrator.execute_pipeline(
                dataset_id, high_bias_config
            )
    
    @pytest.mark.asyncio
    async def test_pipeline_hipaa_compliance(self):
        """Test pipeline HIPAA compliance validation"""
        
        // TEST: Pipeline validates HIPAA compliance for therapeutic data
        therapeutic_dataset_id = "therapeutic_data_001"
        
        result = await self.pipeline_orchestrator.execute_pipeline(
            therapeutic_dataset_id, {'steps': ['validate', 'compliance_check']}
        )
        
        assert result['status'] == 'completed'
        assert 'compliance_status' in result['results']
        assert result['results']['compliance_status'] == 'compliant'
        
        // TEST: Pipeline detects HIPAA violations
        non_compliant_dataset_id = "non_compliant_data_002"
        
        with pytest.raises(HIPAAComplianceError) as exc_info:
            await self.pipeline_orchestrator.execute_pipeline(
                non_compliant_dataset_id, {'steps': ['validate', 'compliance_check']}
            )
        
        assert exc_info.value.error_code == 'HIPAA_COMPLIANCE_ERROR'
    
    @pytest.mark.asyncio
    async def test_pipeline_error_recovery(self):
        """Test pipeline error recovery mechanisms"""
        
        // TEST: Pipeline attempts recovery from recoverable errors
        flaky_dataset_id = "flaky_dataset_003"
        
        result = await self.pipeline_orchestrator.execute_pipeline(
            flaky_dataset_id, {'steps': ['validate', 'process'], 'retry_on_failure': True}
        )
        
        // TEST: Recovery attempt is logged
        assert 'recovery_attempted' in result
        assert result['recovery_attempted'] is True
        
        // TEST: Pipeline reports recovery success
        if result.get('recovery_successful'):
            assert result['status'] == 'completed'
        else:
            assert result['status'] == 'failed'

class TestDataTransformer:
    """Unit tests for data transformation components"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.transformer = DataTransformer()
        self.sample_chatml_data = {
            "conversations": [
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi there!"}
            ]
        }
    
    def test_chatml_to_standard_format(self):
        """Test ChatML format conversion to standard format"""
        
        // TEST: ChatML data converts to standard format correctly
        standard_format = self.transformer.chatml_to_standard(self.sample_chatml_data)
        
        assert 'messages' in standard_format
        assert len(standard_format['messages']) == 2
        assert standard_format['messages'][0]['role'] == 'user'
        assert standard_format['messages'][0]['content'] == 'Hello'
        
        // TEST: Empty ChatML data handles gracefully
        empty_result = self.transformer.chatml_to_standard({'conversations': []})
        assert empty_result['messages'] == []
    
    def test_alpaca_to_standard_format(self):
        """Test Alpaca format conversion to standard format"""
        
        // TEST: Alpaca instruction data converts correctly
        alpaca_data = {
            "instruction": "Translate to French",
            "input": "Hello world",
            "output": "Bonjour le monde"
        }
        
        standard_format = self.transformer.alpaca_to_standard(alpaca_data)
        
        assert len(standard_format['messages']) == 2
        assert 'instruction' in standard_format['messages'][0]['content']
        assert standard_format['messages'][1]['content'] == 'Bonjour le monde'
    
    def test_data_validation_during_transform(self):
        """Test data validation during transformation"""
        
        // TEST: Invalid data raises validation error
        invalid_data = {"invalid": "structure"}
        
        with pytest.raises(ValidationError) as exc_info:
            self.transformer.chatml_to_standard(invalid_data)
        
        assert exc_info.value.error_code == 'VALIDATION_ERROR'
        
        // TEST: Malicious content is sanitized
        malicious_data = {
            "conversations": [
                {"role": "user", "content": "<script>alert('xss')</script>"}
            ]
        }
        
        result = self.transformer.chatml_to_standard(malicious_data)
        assert '<script>' not in result['messages'][0]['content']
    
    def test_privacy_preservation_during_transform(self):
        """Test privacy preservation during data transformation"""
        
        // TEST: PII is detected and handled appropriately
        pii_data = {
            "conversations": [
                {"role": "user", "content": "My email is john@example.com"}
            ]
        }
        
        result = self.transformer.chatml_to_standard(pii_data)
        
        // TEST: PII detection is logged
        assert 'pii_detected' in result.get('metadata', {})
        
        // TEST: Data is flagged for review if PII detected
        if result['metadata']['pii_detected']:
            assert result['metadata']['requires_review'] is True

class TestErrorHandler:
    """Unit tests for error handling components"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.config = TestConfig()
        self.error_handler = ErrorHandler(self.config)
    
    @pytest.mark.asyncio
    async def test_error_classification(self):
        """Test error classification logic"""
        
        // TEST: Authentication errors are classified correctly
        auth_error = AuthenticationError("Invalid credentials")
        classification = await self.error_handler.error_classifier.classify_error(
            auth_error, {}
        )
        
        assert classification['error_code'] == 'AUTH_ERROR'
        assert classification['recoverable'] is False
        
        // TEST: Validation errors are classified correctly
        validation_error = ValidationError("Invalid field format", field="email")
        classification = await self.error_handler.error_classifier.classify_error(
            validation_error, {}
        )
        
        assert classification['error_code'] == 'VALIDATION_ERROR'
        assert classification['recoverable'] is True
    
    @pytest.mark.asyncio
    async def test_hipaa_compliance_error_handling(self):
        """Test HIPAA compliance error handling"""
        
        // TEST: HIPAA compliance errors trigger special handling
        hipaa_error = HIPAAComplianceError(
            "Data encryption required",
            violation_type="unencrypted_phi"
        )
        
        response = await self.error_handler.handle_error(hipaa_error, {})
        
        assert response['error_code'] == 'HIPAA_COMPLIANCE_ERROR'
        assert 'hipaa_compliance' in response
        assert response['hipaa_compliance']['notification_required'] is True
    
    @pytest.mark.asyncio
    async def test_error_message_sanitization(self):
        """Test error message sanitization for security"""
        
        // TEST: Sensitive information is redacted from error messages
        sensitive_error = Exception("API key: sk-1234567890abcdef")
        
        response = await self.error_handler.handle_error(sensitive_error, {})
        
        assert 'sk-1234567890abcdef' not in response['message']
        assert '[REDACTED]' in response['message']
        
        // TEST: Error messages are length-limited
        long_error = Exception("x" * 1000)
        response = await self.error_handler.handle_error(long_error, {})
        
        assert len(response['message']) <= 500
```

---

## Integration Testing Strategy

### Cross-Component Integration Testing

```python
# tests/integration/test_api_integration.py - API integration tests
class TestAPIIntegration:
    """Integration tests for API endpoints"""
    
    @pytest.fixture
    async def test_client(self):
        """Create test client for API testing"""
        from ai.api.techdeck_integration import create_app
        app = create_app(TestConfig())
        return TestClient(app)
    
    @pytest.mark.asyncio
    async def test_dataset_upload_integration(self, test_client):
        """Test complete dataset upload workflow"""
        
        // TEST: Upload endpoint accepts valid dataset file
        test_file = create_test_dataset_file('test_dataset.json', 'json', [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"}
        ])
        
        response = await test_client.post(
            "/api/v1/datasets/upload",
            files={"file": ("test_dataset.json", test_file, "application/json")},
            headers={"Authorization": f"Bearer {get_test_token()}"}
        )
        
        assert response.status_code == 201
        response_data = response.json()
        assert response_data['success'] is True
        assert 'dataset_id' in response_data['data']
        
        dataset_id = response_data['data']['dataset_id']
        
        // TEST: Uploaded dataset can be retrieved
        get_response = await test_client.get(
            f"/api/v1/datasets/{dataset_id}",
            headers={"Authorization": f"Bearer {get_test_token()}"}
        )
        
        assert get_response.status_code == 200
        assert get_response.json()['data']['id'] == dataset_id
        
        // TEST: Dataset validation is performed during upload
        invalid_file = create_test_dataset_file('invalid.json', 'json', {"invalid": "structure"})
        
        invalid_response = await test_client.post(
            "/api/v1/datasets/upload",
            files={"file": ("invalid.json", invalid_file, "application/json")},
            headers={"Authorization": f"Bearer {get_test_token()}"}
        )
        
        assert invalid_response.status_code == 422
        assert invalid_response.json()['error']['code'] == 'VALIDATION_ERROR'
    
    @pytest.mark.asyncio
    async def test_pipeline_execution_integration(self, test_client):
        """Test complete pipeline execution workflow"""
        
        // TEST: Create dataset first
        dataset_response = await test_client.post(
            "/api/v1/datasets",
            json={
                "name": "Integration Test Dataset",
                "description": "Dataset for pipeline integration testing",
                "format": "json",
                "data": [
                    {"role": "user", "content": "Test message"},
                    {"role": "assistant", "content": "Test response"}
                ]
            },
            headers={"Authorization": f"Bearer {get_test_token()}"}
        )
        
        dataset_id = dataset_response.json()['data']['id']
        
        // TEST: Execute pipeline on dataset
        pipeline_response = await test_client.post(
            f"/api/v1/pipelines/execute",
            json={
                "dataset_id": dataset_id,
                "pipeline_config": {
                    "steps": ["validate", "standardize", "analyze"],
                    "output_format": "json"
                }
            },
            headers={"Authorization": f"Bearer {get_test_token()}"}
        )
        
        assert pipeline_response.status_code == 202
        pipeline_data = pipeline_response.json()['data']
        assert 'pipeline_id' in pipeline_data
        assert pipeline_data['status'] == 'running'
        
        pipeline_id = pipeline_data['pipeline_id']
        
        // TEST: Pipeline status can be monitored
        status_response = await test_client.get(
            f"/api/v1/pipelines/{pipeline_id}/status",
            headers={"Authorization": f"Bearer {get_test_token()}"}
        )
        
        assert status_response.status_code == 200
        status_data = status_response.json()['data']
        assert 'progress_percentage' in status_data
        assert 'current_step' in status_data
    
    @pytest.mark.asyncio
    async def test_authentication_integration(self, test_client):
        """Test authentication integration across endpoints"""
        
        // TEST: Protected endpoints require authentication
        response = await test_client.get("/api/v1/datasets")
        assert response.status_code == 401
        
        // TEST: Valid JWT token allows access
        valid_response = await test_client.get(
            "/api/v1/datasets",
            headers={"Authorization": f"Bearer {get_test_token()}"}
        )
        assert valid_response.status_code == 200
        
        // TEST: Invalid JWT token is rejected
        invalid_response = await test_client.get(
            "/api/v1/datasets",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert invalid_response.status_code == 401
        assert invalid_response.json()['error']['code'] == 'AUTH_ERROR'
    
    @pytest.mark.asyncio
    async def test_rate_limiting_integration(self, test_client):
        """Test rate limiting integration"""
        
        // TEST: Rate limiting is enforced
        token = get_test_token()
        
        // Make requests up to the limit
        for i in range(100):  # Assuming 100/minute limit
            response = await test_client.get(
                "/api/v1/datasets/validate",
                headers={"Authorization": f"Bearer {token}"}
            )
            if i < 100:
                assert response.status_code == 200
            else:
                assert response.status_code == 429
                assert response.json()['error']['code'] == 'RATE_LIMIT_ERROR'

class TestSecurityIntegration:
    """Integration tests for security components"""
    
    @pytest.mark.asyncio
    async def test_data_encryption_integration(self):
        """Test data encryption integration"""
        
        // TEST: Sensitive data is encrypted at rest
        sensitive_data = {
            "conversations": [
                {"role": "user", "content": "I feel anxious about my health condition"}
            ]
        }
        
        encrypted_data = await self.encryption_service.encrypt_dataset(sensitive_data)
        
        assert 'encrypted_data' in encrypted_data
        assert 'iv' in encrypted_data
        assert encrypted_data['encryption_level'] == 'standard'
        
        // TEST: Encrypted data can be decrypted
        decrypted_data = await self.encryption_service.decrypt_dataset(encrypted_data)
        assert decrypted_data == sensitive_data
    
    @pytest.mark.asyncio
    async def test_hipaa_compliance_integration(self):
        """Test HIPAA compliance integration"""
        
        // TEST: PHI detection works across components
        phi_data = {
            "patient_name": "John Doe",
            "diagnosis": "Anxiety disorder",
            "treatment_notes": "Patient reports feeling anxious"
        }
        
        compliance_result = await self.compliance_checker.validate_dataset(phi_data)
        
        assert compliance_result['compliant'] is False
        assert 'PHI detected' in compliance_result['violations'][0]
        
        // TEST: HIPAA violations trigger audit logging
        audit_logs = await self.audit_logger.get_logs(
            filters={'error_code': 'HIPAA_COMPLIANCE_ERROR'}
        )
        assert len(audit_logs) > 0
    
    @pytest.mark.asyncio
    async def test_authorization_integration(self):
        """Test role-based authorization integration"""
        
        // TEST: Admin users can access admin endpoints
        admin_token = get_test_token(role='admin')
        admin_response = await test_client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert admin_response.status_code == 200
        
        // TEST: Regular users cannot access admin endpoints
        user_token = get_test_token(role='user')
        user_response = await test_client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert user_response.status_code == 403
        assert user_response.json()['error']['code'] == 'AUTHZ_ERROR'

class TestWebSocketIntegration:
    """Integration tests for WebSocket functionality"""
    
    @pytest.mark.asyncio
    async def test_websocket_connection_integration(self):
        """Test WebSocket connection establishment"""
        
        // TEST: WebSocket connection with valid authentication
        ws_url = f"ws://localhost:8000/ws?auth_token={get_test_token()}"
        
        async with websockets.connect(ws_url) as websocket:
            // Wait for connection acknowledgment
            ack_message = await asyncio.wait_for(websocket.recv(), timeout=5)
            ack_data = json.loads(ack_message)
            
            assert ack_data['type'] == 'connection_ack'
            assert 'client_id' in ack_data
            
            client_id = ack_data['client_id']
            
            // TEST: Heartbeat mechanism works
            ping_message = json.dumps({'type': 'heartbeat_ping', 'sequence': 1})
            await websocket.send(ping_message)
            
            pong_message = await asyncio.wait_for(websocket.recv(), timeout=5)
            pong_data = json.loads(pong_message)
            
            assert pong_data['type'] == 'connection_health'
    
    @pytest.mark.asyncio
    async def test_progress_tracking_integration(self):
        """Test progress tracking through WebSocket"""
        
        // TEST: Progress updates are sent during pipeline execution
        ws_url = f"ws://localhost:8000/ws?auth_token={get_test_token()}"
        
        async with websockets.connect(ws_url) as websocket:
            // Wait for connection acknowledgment
            await asyncio.wait_for(websocket.recv(), timeout=5)
            
            // Start pipeline execution via REST API
            pipeline_response = await test_client.post(
                "/api/v1/pipelines/execute",
                json={
                    "dataset_id": "test_dataset",
                    "pipeline_config": {"steps": ["validate", "analyze"]}
                },
                headers={"Authorization": f"Bearer {get_test_token()}"}
            )
            
            pipeline_id = pipeline_response.json()['data']['pipeline_id']
            
            // Subscribe to progress updates
            subscribe_msg = json.dumps({
                'type': 'subscribe_operation',
                'operation_id': pipeline_id
            })
            await websocket.send(subscribe_msg)
            
            // TEST: Progress updates are received
            progress_updates = []
            for _ in range(10):  # Wait for up to 10 updates
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=2)
                    data = json.loads(message)
                    if data['type'] == 'progress_update':
                        progress_updates.append(data)
                except asyncio.TimeoutError:
                    break
            
            assert len(progress_updates) > 0
            assert all('progress_percentage' in update['data'] for update in progress_updates)
            
            // TEST: Progress percentage increases over time
            progress_values = [update['data']['progress_percentage'] for update in progress_updates]
            assert progress_values[-1] >= progress_values[0]
```

---

## End-to-End Testing Strategy

### Complete User Journey Testing

```python
# tests/e2e/test_user_journey.py - End-to-end user journey tests
class TestUserJourney:
    """End-to-end tests for complete user workflows"""
    
    @pytest.mark.asyncio
    async def test_complete_dataset_pipeline_journey(self):
        """Test complete dataset upload and processing journey"""
        
        // TEST: User can upload a dataset file
        test_file = create_test_dataset_file(
            'complete_journey_dataset.jsonl',
            'jsonl',
            [
                {"role": "user", "content": "I'm feeling anxious today"},
                {"role": "assistant", "content": "I understand you're feeling anxious. Can you tell me more about what's causing these feelings?"},
                {"role": "user", "content": "Work has been really stressful lately"},
                {"role": "assistant", "content": "Work stress can be overwhelming. What specific aspects of work are causing the most stress?"}
            ]
        )
        
        upload_response = await self.client.post(
            "/api/v1/datasets/upload",
            files={"file": ("complete_journey_dataset.jsonl", test_file, "application/jsonl")},
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        assert upload_response.status_code == 201
        dataset_id = upload_response.json()['data']['dataset_id']
        
        // TEST: Dataset appears in user's dataset list
        datasets_response = await self.client.get(
            "/api/v1/datasets",
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        user_datasets = datasets_response.json()['data']['datasets']
        dataset_ids = [ds['id'] for ds in user_datasets]
        assert dataset_id in dataset_ids
        
        // TEST: User can view dataset details
        detail_response = await self.client.get(
            f"/api/v1/datasets/{dataset_id}",
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        assert detail_response.status_code == 200
        dataset_info = detail_response.json()['data']
        assert dataset_info['id'] == dataset_id
        assert dataset_info['format'] == 'jsonl'
        
        // TEST: User can execute pipeline on dataset
        pipeline_response = await self.client.post(
            "/api/v1/pipelines/execute",
            json={
                "dataset_id": dataset_id,
                "pipeline_config": {
                    "steps": ["validate", "standardize", "bias_check", "analyze"],
                    "output_format": "json",
                    "bias_threshold": 0.7
                }
            },
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        assert pipeline_response.status_code == 202
        pipeline_data = pipeline_response.json()['data']
        pipeline_id = pipeline_data['pipeline_id']
        
        // TEST: User can monitor pipeline progress
        max_wait_time = 300  # 5 minutes
        start_time = time.time()
        pipeline_completed = False
        
        while time.time() - start_time < max_wait_time and not pipeline_completed:
            status_response = await self.client.get(
                f"/api/v1/pipelines/{pipeline_id}/status",
                headers={"Authorization": f"Bearer {self.user_token}"}
            )
            
            assert status_response.status_code == 200
            status_data = status_response.json()['data']
            
            if status_data['status'] in ['completed', 'failed']:
                pipeline_completed = True
                break
            
            await asyncio.sleep(5)  # Wait 5 seconds before checking again
        
        assert pipeline_completed, "Pipeline did not complete within timeout"
        assert status_data['status'] == 'completed'
        
        // TEST: User can retrieve pipeline results
        results_response = await self.client.get(
            f"/api/v1/pipelines/{pipeline_id}/results",
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        assert results_response.status_code == 200
        results_data = results_response.json()['data']
        assert 'results' in results_data
        assert 'bias_report' in results_data['results']
        
        // TEST: Dataset quality metrics are available
        quality_response = await self.client.get(
            f"/api/v1/datasets/{dataset_id}/quality",
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        assert quality_response.status_code == 200
        quality_data = quality_response.json()['data']
        assert 'quality_score' in quality_data
        assert quality_data['quality_score'] >= 0
        assert quality_data['quality_score'] <= 1
    
    @pytest.mark.asyncio
    async def test_error_recovery_journey(self):
        """Test error recovery and user guidance journey"""
        
        // TEST: User receives helpful error messages
        // Attempt to upload invalid file
        invalid_file = io.BytesIO(b"This is not valid JSON")
        
        error_response = await self.client.post(
            "/api/v1/datasets/upload",
            files={"file": ("invalid.txt", invalid_file, "text/plain")},
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        assert error_response.status_code == 422
        error_data = error_response.json()
        assert error_data['success'] is False
        assert 'user_guidance' in error_data['error']
        assert 'documentation_url' in error_data['error']['request_tracking']
        
        // TEST: User can retry with corrected input
        valid_file = create_test_dataset_file(
            'retry_dataset.json',
            'json',
            [{"role": "user", "content": "Hello world"}]
        )
        
        retry_response = await self.client.post(
            "/api/v1/datasets/upload",
            files={"file": ("retry_dataset.json", valid_file, "application/json")},
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        assert retry_response.status_code == 201
    
    @pytest.mark.asyncio
    async def test_concurrent_user_journey(self):
        """Test multiple users using the system concurrently"""
        
        // TEST: Multiple users can upload datasets simultaneously
        upload_tasks = []
        for i in range(5):
            user_token = get_test_token(user_id=f"concurrent_user_{i}")
            test_file = create_test_dataset_file(
                f'concurrent_dataset_{i}.json',
                'json',
                [{"role": "user", "content": f"User {i} message"}]
            )
            
            task = self.client.post(
                "/api/v1/datasets/upload",
                files={"file": (f"concurrent_dataset_{i}.json", test_file, "application/json")},
                headers={"Authorization": f"Bearer {user_token}"}
            )
            upload_tasks.append(task)
        
        // Execute all uploads concurrently
        upload_results = await asyncio.gather(*upload_tasks)
        
        // TEST: All uploads succeed
        dataset_ids = []
        for response in upload_results:
            assert response.status_code == 201
            dataset_ids.append(response.json()['data']['dataset_id'])
        
        // TEST: Each user can only see their own datasets
        for i, dataset_id in enumerate(dataset_ids):
            user_token = get_test_token(user_id=f"concurrent_user_{i}")
            
            user_datasets_response = await self.client.get(
                "/api/v1/datasets",
                headers={"Authorization": f"Bearer {user_token}"}
            )
            
            user_datasets = user_datasets_response.json()['data']['datasets']
            user_dataset_ids = [ds['id'] for ds in user_datasets]
            
            assert dataset_id in user_dataset_ids
            assert len(user_dataset_ids) == 1  # Each user should only see their dataset

class TestHIPAAComplianceJourney:
    """End-to-end tests for HIPAA compliance workflows"""
    
    @pytest.mark.asyncio
    async def test_therapeutic_data_handling_compliance(self):
        """Test complete HIPAA compliance for therapeutic data"""
        
        // TEST: Upload therapeutic dataset with PHI
        therapeutic_data = [
            {"role": "user", "content": "I've been diagnosed with anxiety and it's affecting my work"},
            {"role": "assistant", "content": "Thank you for sharing that. Anxiety can be challenging, especially when it impacts your professional life."},
            {"role": "user", "content": "My doctor prescribed medication but I'm worried about side effects"},
            {"role": "assistant", "content": "It's completely understandable to have concerns about medication side effects. Have you discussed these concerns with your healthcare provider?"}
        ]
        
        test_file = create_test_dataset_file(
            'therapeutic_dataset.json',
            'json',
            therapeutic_data
        )
        
        upload_response = await self.client.post(
            "/api/v1/datasets/upload",
            files={"file": ("therapeutic_dataset.json", test_file, "application/json")},
            headers={"Authorization": f"Bearer {self.therapist_token}"}
        )
        
        assert upload_response.status_code == 201
        dataset_id = upload_response.json()['data']['dataset_id']
        
        // TEST: HIPAA compliance validation is performed
        compliance_response = await self.client.post(
            f"/api/v1/datasets/{dataset_id}/validate-compliance",
            headers={"Authorization": f"Bearer {self.therapist_token}"}
        )
        
        assert compliance_response.status_code == 200
        compliance_data = compliance_response.json()['data']
        assert 'compliance_status' in compliance_data
        assert 'hipaa_requirements' in compliance_data
        
        // TEST: Audit trail is created for therapeutic data access
        audit_response = await self.client.get(
            "/api/v1/audit/logs",
            params={"dataset_id": dataset_id, "limit": 10},
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        assert audit_response.status_code == 200
        audit_logs = audit_response.json()['data']['logs']
        assert len(audit_logs) > 0
        
        // TEST: Data access is logged with user identification
        access_logs = [log for log in audit_logs if log['action'] == 'dataset_access']
        assert len(access_logs) > 0
        assert access_logs[0]['user_id'] is not None
        assert access_logs[0]['timestamp'] is not None
        
        // TEST: Data encryption is verified
        encryption_response = await self.client.get(
            f"/api/v1/datasets/{dataset_id}/encryption-status",
            headers={"Authorization": f"Bearer {self.therapist_token}"}
        )
        
        assert encryption_response.status_code == 200
        encryption_data = encryption_response.json()['data']
        assert encryption_data['encrypted'] is True
        assert encryption_data['encryption_level'] in ['standard', 'enhanced', 'maximum']
    
    @pytest.mark.asyncio
    async def test_data_breach_detection_and_response(self):
        """Test data breach detection and incident response"""
        
        // TEST: Simulate unauthorized access attempt
        unauthorized_token = get_test_token(user_id="unauthorized_user")
        
        // Try to access admin-only audit logs
        breach_attempt = await self.client.get(
            "/api/v1/admin/audit/logs",
            headers={"Authorization": f"Bearer {unauthorized_token}"}
        )
        
        assert breach_attempt.status_code == 403
        
        // TEST: Security incident is logged
        security_logs_response = await self.client.get(
            "/api/v1/security/incidents",
            headers={"Authorization": f"Bearer {self.security_token}"}
        )
        
        assert security_logs_response.status_code == 200
        security_incidents = security_logs_response.json()['data']['incidents']
        
        unauthorized_access_incidents = [
            incident for incident in security_incidents
            if incident['type'] == 'unauthorized_access_attempt'
        ]
        
        assert len(unauthorized_access_incidents) > 0
        assert unauthorized_access_incidents[0]['user_id'] == "unauthorized_user"
        
        // TEST: Breach notification system is triggered for serious violations
        serious_breach_response = await self.client.post(
            "/api/v1/security/report-incident",
            json={
                "incident_type": "data_breach",
                "severity": "high",
                "description": "Unauthorized access to therapeutic data",
                "affected_records": 150
            },
            headers={"Authorization": f"Bearer {self.security_token}"}
        )
        
        assert serious_breach_response.status_code == 201
        incident_data = serious_breach_response.json()['data']
        assert incident_data['notification_sent'] is True
        assert incident_data['compliance_team_notified'] is True
```

---

## Performance Testing Strategy

### Load and Stress Testing

```python
# tests/performance/test_load_pipeline.py - Performance and load tests
class TestPipelinePerformance:
    """Performance tests for pipeline operations"""
    
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_pipeline_execution_performance(self):
        """Test pipeline execution performance under normal load"""
        
        // TEST: Pipeline execution meets performance requirements
        dataset_size = 1000  # 1000 conversation pairs
        test_dataset = generate_test_dataset(dataset_size)
        
        start_time = time.time()
        
        result = await self.pipeline_orchestrator.execute_pipeline(
            test_dataset['id'],
            {'steps': ['validate', 'standardize', 'bias_check', 'analyze']}
        )
        
        execution_time = time.time() - start_time
        
        assert result['status'] == 'completed'
        assert execution_time < 30  # Should complete within 30 seconds for 1000 records
        
        // TEST: Performance scales reasonably with dataset size
        performance_metrics = []
        
        for size in [100, 500, 1000, 5000]:
            test_dataset = generate_test_dataset(size)
            
            start_time = time.time()
            result = await self.pipeline_orchestrator.execute_pipeline(
                test_dataset['id'],
                {'steps': ['validate', 'analyze']}
            )
            execution_time = time.time() - start_time
            
            performance_metrics.append({
                'dataset_size': size,
                'execution_time': execution_time,
                'records_per_second': size / execution_time
            })
        
        // TEST: Performance scales linearly or better
        for i in range(1, len(performance_metrics)):
            prev_metric = performance_metrics[i-1]
            curr_metric = performance_metrics[i]
            
            size_ratio = curr_metric['dataset_size'] / prev_metric['dataset_size']
            time_ratio = curr_metric['execution_time'] / prev_metric['execution_time']
            
            // Time should not increase faster than dataset size
            assert time_ratio <= size_ratio * 1.5  # Allow 50% overhead
    
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_concurrent_pipeline_execution(self):
        """Test pipeline performance under concurrent load"""
        
        // TEST: Multiple pipelines can execute concurrently
        concurrent_pipelines = 5
        datasets = [generate_test_dataset(200) for _ in range(concurrent_pipelines)]
        
        start_time = time.time()
        
        // Execute all pipelines concurrently
        pipeline_tasks = [
            self.pipeline_orchestrator.execute_pipeline(
                dataset['id'],
                {'steps': ['validate', 'bias_check', 'analyze']}
            )
            for dataset in datasets
        ]
        
        results = await asyncio.gather(*pipeline_tasks)
        total_time = time.time() - start_time
        
        // TEST: All pipelines complete successfully
        assert all(result['status'] == 'completed' for result in results)
        
        // TEST: Concurrent execution is faster than sequential
        sequential_time_estimate = concurrent_pipelines * 15  # Estimate 15s per pipeline
        assert total_time < sequential_time_estimate * 0.7  # Should be at least 30% faster
        
        // TEST: Individual pipeline performance doesn't degrade significantly
        individual_times = [result['actual_duration_seconds'] for result in results]
        avg_individual_time = sum(individual_times) / len(individual_times)
        
        // Individual times should be within 50% of single pipeline time
        single_pipeline_time = 15  # Expected time for single pipeline
        assert avg_individual_time < single_pipeline_time * 1.5
    
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_upload_performance(self):
        """Test file upload performance"""
        
        // TEST: Upload performance meets requirements
        file_sizes = [1, 10, 50, 100]  # MB
        
        upload_metrics = []
        
        for size_mb in file_sizes:
            test_file = create_large_test_file(size_mb)
            
            start_time = time.time()
            response = await self.client.post(
                "/api/v1/datasets/upload",
                files={"file": (f"large_file_{size_mb}mb.json", test_file, "application/json")},
                headers={"Authorization": f"Bearer {get_test_token()}"}
            )
            upload_time = time.time() - start_time
            
            assert response.status_code == 201
            
            upload_metrics.append({
                'file_size_mb': size_mb,
                'upload_time_seconds': upload_time,
                'upload_speed_mbps': size_mb / upload_time
            })
        
        // TEST: Upload speed is reasonable (at least 1 MB/s)
        for metric in upload_metrics:
            assert metric['upload_speed_mbps'] >= 1.0
            
            // TEST: Upload time scales linearly with file size
            if metric['file_size_mb'] > 1:
                expected_time = metric['file_size_mb'] / 5  # Expect at least 5 MB/s
                assert metric['upload_time_seconds'] <= expected_time * 2  # Allow 2x variance
    
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_websocket_performance(self):
        """Test WebSocket communication performance"""
        
        // TEST: WebSocket message latency is acceptable
        ws_url = f"ws://localhost:8000/ws?auth_token={get_test_token()}"
        
        async with websockets.connect(ws_url) as websocket:
            // Wait for connection acknowledgment
            await asyncio.wait_for(websocket.recv(), timeout=5)
            
            // Measure round-trip time for messages
            latencies = []
            
            for i in range(10):
                start_time = time.time()
                
                test_message = json.dumps({
                    'type': 'test_echo',
                    'data': {'message': f'test_{i}'},
                    'timestamp': start_time
                })
                
                await websocket.send(test_message)
                response = await asyncio.wait_for(websocket.recv(), timeout=5)
                
                end_time = time.time()
                latency_ms = (end_time - start_time) * 1000
                
                latencies.append(latency_ms)
            
            // TEST: Average latency is under 100ms
            avg_latency = sum(latencies) / len(latencies)
            assert avg_latency < 100
            
            // TEST: Maximum latency is under 500ms
            max_latency = max(latencies)
            assert max_latency < 500
    
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_memory_usage_stability(self):
        """Test memory usage stability during operations"""
        
        import psutil
        import gc
        
        process = psutil.Process()
        
        // Get baseline memory usage
        gc.collect()
        baseline_memory = process.memory_info().rss / (1024 * 1024)  # MB
        
        // TEST: Memory usage during pipeline execution
        test_dataset = generate_test_dataset(5000)  # Large dataset
        
        // Execute pipeline multiple times
        for i in range(5):
            result = await self.pipeline_orchestrator.execute_pipeline(
                test_dataset['id'],
                {'steps': ['validate', 'analyze']}
            )
            assert result['status'] == 'completed'
            
            // Force garbage collection
            gc.collect()
            
            current_memory = process.memory_info().rss / (1024 * 1024)
            memory_increase = current_memory - baseline_memory
            
            // TEST: Memory increase is reasonable (< 100MB per execution)
            assert memory_increase < 100
            
            // TEST: Memory doesn't grow continuously
            if i > 0:
                assert memory_increase < 50  # Should stabilize after first execution

class TestStressConditions:
    """Stress testing for extreme conditions"""
    
    @pytest.mark.stress
    @pytest.mark.asyncio
    async def test_extreme_dataset_size(self):
        """Test system behavior with extremely large datasets"""
        
        // TEST: System handles large datasets gracefully
        large_dataset = generate_test_dataset(50000)  # 50,000 records
        
        result = await self.pipeline_orchestrator.execute_pipeline(
            large_dataset['id'],
            {'steps': ['validate', 'analyze']}
        )
        
        // Should either complete successfully or fail gracefully with helpful error
        if result['status'] == 'completed':
            assert 'results' in result
        else:
            assert result['status'] == 'failed'
            assert 'error' in result
            assert 'user_guidance' in result['error']
            assert 'dataset too large' in result['error']['message'].lower()
    
    @pytest.mark.stress
    @pytest.mark.asyncio
    async def test_rapid_sequential_requests(self):
        """Test system under rapid sequential requests"""
        
        // TEST: System handles rapid requests without degradation
        request_times = []
        
        for i in range(50):
            start_time = time.time()
            
            response = await self.client.get(
                "/api/v1/datasets/validate",
                params={"dataset_id": f"test_dataset_{i}"},
                headers={"Authorization": f"Bearer {get_test_token()}"}
            )
            
            request_time = time.time() - start_time
            request_times.append(request_time)
            
            assert response.status_code in [200, 404]  # Valid responses
        
        // TEST: Request times remain stable
        avg_time = sum(request_times) / len(request_times)
        max_time = max(request_times)
        
        // Average should be under 1 second
        assert avg_time < 1.0
        
        // Maximum should be under 5 seconds
        assert max_time < 5.0
        
        // Variance should be reasonable (not more than 3x average)
        assert max_time < avg_time * 3
    
    @pytest.mark.stress
    @pytest.mark.asyncio
    async def test_resource_exhaustion_recovery(self):
        """Test system recovery from resource exhaustion"""
        
        // TEST: System recovers gracefully from memory pressure
        // This is a simulated test - in real scenarios you'd use resource limits
        
        // Simulate high memory usage
        large_objects = []
        try:
            for i in range(100):
                large_objects.append(bytearray(10 * 1024 * 1024))  # 10MB each
            
            // Attempt pipeline execution under memory pressure
            test_dataset = generate_test_dataset(1000)
            result = await self.pipeline_orchestrator.execute_pipeline(
                test_dataset['id'],
                {'steps': ['validate', 'analyze']}
            )
            
            // Should either complete or fail gracefully
            assert result['status'] in ['completed', 'failed']
            
            if result['status'] == 'failed':
                assert 'resource' in result['error']['message'].lower() or \
                       'memory' in result['error']['message'].lower()
        
        finally:
            // Clean up
            large_objects.clear()
            gc.collect()
        
        // TEST: System recovers and operates normally after pressure
        normal_dataset = generate_test_dataset(500)
        recovery_result = await self.pipeline_orchestrator.execute_pipeline(
            normal_dataset['id'],
            {'steps': ['validate', 'analyze']}
        )
        
        assert recovery_result['status'] == 'completed'
```

---

## Security Testing Strategy

### Comprehensive Security Validation

```python
# tests/security/test_authentication.py - Security-focused authentication tests
class TestAuthenticationSecurity:
    """Security tests for authentication mechanisms"""
    
    @pytest.mark.security
    @pytest.mark.asyncio
    async def test_jwt_token_security(self):
        """Test JWT token security features"""
        
        // TEST: Tokens expire correctly
        short_lived_token = generate_test_token(expiry_hours=0.1)  # 6 minutes
        
        // Token should work immediately
        response = await self.client.get(
            "/api/v1/datasets",
            headers={"Authorization": f"Bearer {short_lived_token}"}
        )
        assert response.status_code == 200
        
        // Wait for token to expire
        await asyncio.sleep(370)  # Wait 6 minutes and 10 seconds
        
        // Token should be rejected after expiry
        expired_response = await self.client.get(
            "/api/v1/datasets",
            headers={"Authorization": f"Bearer {short_lived_token}"}
        )
        assert expired_response.status_code == 401
        assert expired_response.json()['error']['code'] == 'AUTH_ERROR'
    
    @pytest.mark.security
    @pytest.mark.asyncio
    async def test_token_replay_protection(self):
        """Test protection against token replay attacks"""
        
        // TEST: Same token from different IP addresses is detected
        token = get_test_token()
        
        // First request from original IP
        response1 = await self.client.get(
            "/api/v1/datasets",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Forwarded-For": "192.168.1.100"
            }
        )
        assert response1.status_code == 200
        
        // Same token from different IP should be flagged
        response2 = await self.client.get(
            "/api/v1/datasets",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Forwarded-For": "192.168.1.200"
            }
        )
        
        // Should either be rejected or logged as suspicious
        if response2.status_code == 401:
            assert response2.json()['error']['code'] == 'AUTH_ERROR'
        else:
            // Check that suspicious activity was logged
            security_logs = await self.get_security_logs()
            suspicious_logs = [
                log for log in security_logs
                if log.get('suspicious_activity') == 'ip_mismatch'
            ]
            assert len(suspicious_logs) > 0
    
    @pytest.mark.security
    @pytest.mark.asyncio
    async def test_brute_force_protection(self):
        """Test protection against brute force attacks"""
        
        // TEST: Multiple failed authentication attempts trigger rate limiting
        invalid_token = "invalid_token_123"
        
        failed_attempts = 0
        rate_limited = False
        
        for i in range(20):  # Try many invalid tokens
            response = await self.client.get(
                "/api/v1/datasets",
                headers={"Authorization": f"Bearer {invalid_token}_{i}"}
            )
            
            if response.status_code == 429:  # Rate limited
                rate_limited = True
                break
            elif response.status_code == 401:
                failed_attempts += 1
        
        // TEST: Rate limiting is triggered after multiple failures
        assert rate_limited is True or failed_attempts >= 10
        
        // TEST: Security incident is logged
        security_logs = await self.get_security_logs()
        brute_force_logs = [
            log for log in security_logs
            if log.get('incident_type') == 'brute_force_attempt'
        ]
        assert len(brute_force_logs) > 0

class TestDataSecurity:
    """Security tests for data protection"""
    
    @pytest.mark.security
    @pytest.mark.asyncio
    async def test_data_encryption_in_transit(self):
        """Test data encryption in transit"""
        
        // TEST: Sensitive data is encrypted during API calls
        sensitive_data = {
            "conversations": [
                {"role": "user", "content": "I'm having panic attacks and my doctor prescribed Xanax"},
                {"role": "assistant", "content": "I understand you're experiencing panic attacks. How are you feeling about the medication your doctor prescribed?"}
            ]
        }
        
        // Monitor network traffic (in real tests, use network monitoring tools)
        response = await self.client.post(
            "/api/v1/datasets",
            json={
                "name": "Sensitive Data Test",
                "format": "json",
                "data": sensitive_data
            },
            headers={"Authorization": f"Bearer {get_test_token()}"}
        )
        
        assert response.status_code == 201
        
        // TEST: Data is encrypted in database
        dataset_id = response.json()['data']['id']
        
        // Direct database query should return encrypted data
        raw_data = await self.get_raw_database_data(dataset_id)
        
        // Data should not be readable in plain text
        assert "Xanax" not in str(raw_data)
        assert "panic attacks" not in str(raw_data)
        assert "ENCRYPTED" in str(raw_data).upper() or len(str(raw_data)) > len(json.dumps(sensitive_data)) * 2
    
    @pytest.mark.security
    @pytest.mark.asyncio
    async def test_sql_injection_prevention(self):
        """Test SQL injection prevention"""
        
        // TEST: SQL injection attempts are blocked
        malicious_inputs = [
            "'; DROP TABLE datasets; --",
            "' OR '1'='1",
            "1; DELETE FROM users WHERE 1=1",
            "' UNION SELECT * FROM users--"
        ]
        
        for malicious_input in malicious_inputs:
            // Try various injection points
            responses = await asyncio.gather(
                self.client.get(
                    f"/api/v1/datasets/{malicious_input}",
                    headers={"Authorization": f"Bearer {get_test_token()}"}
                ),
                self.client.get(
                    "/api/v1/datasets",
                    params={"search": malicious_input},
                    headers={"Authorization": f"Bearer {get_test_token()}"}
                ),
                self.client.post(
                    "/api/v1/datasets",
                    json={"name": malicious_input, "format": "json", "data": []},
                    headers={"Authorization": f"Bearer {get_test_token()}"}
                ),
                return_exceptions=True
            )
            
            for response in responses:
                if not isinstance(response, Exception):
                    // Should not crash or expose database errors
                    assert response.status_code != 500
                    if response.status_code == 200:
                        // Should return empty or safe results
                        response_data = response.json()
                        assert 'error' not in response_data or response_data['error']['code'] != 'DATABASE_ERROR'
    
    @pytest.mark.security
    @pytest.mark.asyncio
    async def test_xss_prevention(self):
        """Test XSS (Cross-Site Scripting) prevention"""
        
        // TEST: XSS payloads are sanitized
        xss_payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "javascript:alert('XSS')",
            "<iframe src='javascript:alert(\"XSS\")'></iframe>"
        ]
        
        for payload in xss_payloads:
            // Try to store XSS payload in dataset
            response = await self.client.post(
                "/api/v1/datasets",
                json={
                    "name": "XSS Test",
                    "format": "json",
                    "data": [
                        {"role": "user", "content": f"Test message {payload}"},
                        {"role": "assistant", "content": f"Response with {payload}"}
                    ]
                },
                headers={"Authorization": f"Bearer {get_test_token()}"}
            )
            
            assert response.status_code == 201
            dataset_id = response.json()['data']['id']
            
            // Retrieve data and verify XSS is sanitized
            get_response = await self.client.get(
                f"/api/v1/datasets/{dataset_id}",
                headers={"Authorization": f"Bearer {get_test_token()}"}
            )
            
            dataset_data = get_response.json()['data']
            content = str(dataset_data)
            
            // XSS patterns should be sanitized
            assert "<script>" not in content or "<script>" in content
            assert "javascript:" not in content.lower()
            assert "onerror=" not in content.lower()

class TestHIPAASecurityCompliance:
    """Security tests specific to HIPAA compliance"""
    
    @pytest.mark.security
    @pytest.mark.asyncio
    async def test_phi_detection_and_handling(self):
        """Test PHI (Protected Health Information) detection and handling"""
        
        // TEST: Various types of PHI are detected
        phi_test_cases = [
            {
                "data": [{"role": "user", "content": "My name is John Smith and I'm 25 years old"}],
                "expected_phi": ["name", "age"]
            },
            {
                "data": [{"role": "user", "content": "My email is john.smith@email.com"}],
                "expected_phi": ["email"]
            },
            {
                "data": [{"role": "user", "content": "My phone number is 555-123-4567"}],
                "expected_phi": ["phone"]
            },
            {
                "data": [{"role": "user", "content": "I live at 123 Main St, Anytown, USA"}],
                "expected_phi": ["address"]
            },
            {
                "data": [{"role": "user", "content": "My SSN is 123-45-6789"}],
                "expected_phi": ["ssn"]
            }
        ]
        
        for test_case in phi_test_cases:
            response = await self.client.post(
                "/api/v1/datasets",
                json={
                    "name": "PHI Detection Test",
                    "format": "json",
                    "data": test_case["data"]
                },
                headers={"Authorization": f"Bearer {get_test_token()}"}
            )
            
            assert response.status_code == 201
            dataset_id = response.json()['data']['id']
            
            // Check compliance validation
            compliance_response = await self.client.get(
                f"/api/v1/datasets/{dataset_id}/compliance-status",
                headers={"Authorization": f"Bearer {get_test_token()}"}
            )
            
            compliance_data = compliance_response.json()['data']
            assert compliance_data['phi_detected'] is True
            assert len(compliance_data['phi_types']) > 0
    
    @pytest.mark.security
    @pytest.mark.asyncio
    async def test_minimum_necessary_principle(self):
        """Test minimum necessary principle enforcement"""
        
        // TEST: Users can only access data they need for their role
        therapist_token = get_test_token(role='therapist')
        admin_token = get_test_token(role='admin')
        
        // Create dataset with sensitive information
        sensitive_dataset = {
            "name": "Sensitive Patient Data",
            "format": "json",
            "data": [
                {"role": "user", "content": "Patient reports severe anxiety symptoms"},
                {"role": "assistant", "content": "I understand you're experiencing severe anxiety. Let's discuss coping strategies."}
            ]
        }
        
        upload_response = await self.client.post(
            "/api/v1/datasets",
            json=sensitive_dataset,
            headers={"Authorization": f"Bearer {therapist_token}"}
        )
        
        dataset_id = upload_response.json()['data']['id']
        
        // TEST: Therapist can access their patient's data
        therapist_access = await self.client.get(
            f"/api/v1/datasets/{dataset_id}",
            headers={"Authorization": f"Bearer {therapist_token}"}
        )
        assert therapist_access.status_code == 200
        
        // TEST: Admin can access for administrative purposes
        admin_access = await self.client.get(
            f"/api/v1/datasets/{dataset_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert admin_access.status_code == 200
        
        // TEST: Regular user cannot access sensitive data
        user_token = get_test_token(role='user')
        user_access = await self.client.get(
            f"/api/v1/datasets/{dataset_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert user_access.status_code == 403
    
    @pytest.mark.security
    @pytest.mark.asyncio
    async def test_audit_trail_integrity(self):
        """Test audit trail integrity and tamper detection"""
        
        // TEST: All access to PHI is logged
        therapeutic_data = {
            "name": "Therapeutic Session Data",
            "format": "json",
            "data": [
                {"role": "user", "content": "I've been having panic attacks"},
                {"role": "assistant", "content": "Tell me more about when these panic attacks occur."}
            ]
        }
        
        // Upload data
        upload_response = await self.client.post(
            "/api/v1/datasets",
            json=therapeutic_data,
            headers={"Authorization": f"Bearer {get_test_token(role='therapist')}"}
        )
        
        dataset_id = upload_response.json()['data']['id']
        
        // Access data multiple times
        for _ in range(3):
            await self.client.get(
                f"/api/v1/datasets/{dataset_id}",
                headers={"Authorization": f"Bearer {get_test_token(role='therapist')}"}
            )
        
        // Check audit logs
        audit_response = await self.client.get(
            "/api/v1/audit/logs",
            params={
                "dataset_id": dataset_id,
                "action": "dataset_access",
                "limit": 10
            },
            headers={"Authorization": f"Bearer {get_test_token(role='admin')}"}
        )
        
        audit_logs = audit_response.json()['data']['logs']
        
        // TEST: All access attempts are logged
        assert len(audit_logs) >= 3  # At least 3 access attempts
        
        // TEST: Audit logs contain required information
        for log in audit_logs:
            assert 'timestamp' in log
            assert 'user_id' in log
            assert 'action' in log
            assert log['action'] == 'dataset_access'
            assert 'ip_address' in log
            assert 'success' in log
        
        // TEST: Audit logs are immutable (cannot be modified)
        original_log = audit_logs[0]
        
        // Attempt to modify audit log (should fail)
        modify_response = await self.client.put(
            f"/api/v1/audit/logs/{original_log['log_id']}",
            json={"success": False},  // Try to change the log
            headers={"Authorization": f"Bearer {get_test_token(role='admin')}"}
        )
        
        // Should either fail or not actually modify the log
        assert modify_response.status_code in [403, 404, 405]  # Forbidden, Not Found, or Method Not Allowed
        
        // Verify log wasn't modified
        verify_response = await self.client.get(
            f"/api/v1/audit/logs/{original_log['log_id']}",
            headers={"Authorization": f"Bearer {get_test_token(role='admin')}"}
        )
        
        if verify_response.status_code == 200:
            verified_log = verify_response.json()['data']
            assert verified_log['success'] == original_log['success']
```

---

## Test Data Management and Fixtures

### Comprehensive Test Data Strategy

```python
# tests/fixtures/test_data_factory.py - Test data generation and management
class TestDataFactory:
    """Factory for creating test data with various characteristics"""
    
    def __init__(self):
        self.faker = Faker()
        self.conversation_templates = self._load_conversation_templates()
    
    def create_therapeutic_conversation(self, complexity='simple', 
                                      include_phi=False, 
                                      conversation_length=5):
        """Create therapeutic conversation data"""
        
        conversation = []
        
        // Base therapeutic scenarios
        scenarios = {
            'simple': [
                ("user", "I've been feeling anxious lately"),
                ("assistant", "I understand you're feeling anxious. Can you tell me more about what's been happening?"),
                ("user", "Work has been stressful and it's affecting my sleep"),
                ("assistant", "Work stress can definitely impact sleep. What specific aspects of work are most stressful?")
            ],
            'moderate': [
                ("user", "I've been having panic attacks and I don't know what to do"),
                ("assistant", "I'm sorry you're experiencing panic attacks. That must be very frightening. Have you spoken to a healthcare provider about this?"),
                ("user", "Yes, my doctor mentioned therapy but I'm nervous about it"),
                ("assistant", "It's completely understandable to feel nervous about starting therapy. What concerns do you have about it?")
            ],
            'complex': [
                ("user", "I've been diagnosed with PTSD from childhood trauma and I'm struggling with flashbacks"),
                ("assistant", "Thank you for sharing that. PTSD from childhood trauma can be very challenging, especially when flashbacks occur. How have you been coping with the flashbacks?"),
                ("user", "I've been avoiding triggers but it's limiting my life significantly"),
                ("assistant", "Avoidance is a common coping mechanism, but you're right that it can become very limiting. Have you worked with a therapist on gradual exposure techniques?")
            ]
        }
        
        selected_scenario = scenarios.get(complexity, scenarios['simple'])
        
        // Build conversation
        for role, content in selected_scenario:
            if include_phi and role == 'user':
                // Add PHI to user messages
                phi_variations = [
                    f"My name is {self.faker.name()} and {content.lower()}",
                    f"I live at {self.faker.address()} and {content.lower()}",
                    f"My email is {self.faker.email()} and {content.lower()}"
                ]
                content = random.choice(phi_variations)
            
            conversation.append({
                "role": role,
                "content": content,
                "timestamp": (datetime.now() - timedelta(minutes=len(conversation)*5)).isoformat()
            })
        
        // Extend conversation to desired length
        while len(conversation) < conversation_length:
            last_message = conversation[-1]
            
            if last_message['role'] == 'assistant':
                // Add user response
                user_responses = [
                    "That makes sense. I'll try to be more aware of that.",
                    "I hadn't thought about it that way before.",
                    "It's been difficult but I'm trying to work through it.",
                    "Thank you for listening. That helps."
                ]
                
                conversation.append({
                    "role": "user",
                    "content": random.choice(user_responses),
                    "timestamp": (datetime.now() - timedelta(minutes=len(conversation)*5)).isoformat()
                })
            else:
                // Add assistant response
                assistant_responses = [
                    "You're welcome. Remember, progress takes time and patience.",
                    "It's okay to take things one step at a time.",
                    "Your feelings are valid, and it's good that you're expressing them.",
                    "Would you like to explore some coping strategies together?"
                ]
                
                conversation.append({
                    "role": "assistant",
                    "content": random.choice(assistant_responses),
                    "timestamp": (datetime.now() - timedelta(minutes=len(conversation)*5)).isoformat()
                })
        
        return conversation
    
    def create_dataset_file(self, format_type, conversations, 
                          filename=None, include_metadata=True):
        """Create dataset file in specified format"""
        
        if filename is None:
            filename = f"test_dataset_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{format_type}"
        
        if format_type == 'json':
            data = {
                "conversations": conversations,
                "metadata": {
                    "created_at": datetime.now().isoformat(),
                    "conversation_count": len(conversations),
                    "format": "conversation_pairs"
                } if include_metadata else {}
            }
            return json.dumps(data, indent=2).encode('utf-8')
        
        elif format_type == 'jsonl':
            lines = []
            for conv in conversations:
                lines.append(json.dumps(conv))
            return '\n'.join(lines).encode('utf-8')
        
        elif format_type == 'csv':
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(['role', 'content', 'timestamp'])
            
            for conv in conversations:
                writer.writerow([
                    conv.get('role', ''),
                    conv.get('content', ''),
                    conv.get('timestamp', '')
                ])
            
            return output.getvalue().encode('utf-8')
        
        else:
            raise ValueError(f"Unsupported format: {format_type}")
    
    def create_malicious_dataset(self, attack_type):
        """Create dataset with malicious content for security testing"""
        
        if attack_type == 'xss':
            return [
                {"role": "user", "content": "<script>alert('XSS')</script>"},
                {"role": "assistant", "content": "Response with <img src=x onerror=alert('XSS')>"}
            ]
        
        elif attack_type == 'sql_injection':
            return [
                {"role": "user", "content": "'; DROP TABLE datasets; --"},
                {"role": "assistant", "content": "Response to UNION SELECT * FROM users--"}
            ]
        
        elif attack_type == 'path_traversal':
            return [
                {"role": "user", "content": "../../../etc/passwd"},
                {"role": "assistant", "content": "Response with ../../../../windows/system32/config/sam"}
            ]
        
        elif attack_type == 'command_injection':
            return [
                {"role": "user", "content": "$(rm -rf /)"},
                {"role": "assistant", "content": "Response with `cat /etc/passwd`"}
            ]
        
        else:
            return [{"role": "user", "content": f"Test {attack_type}"}]
    
    def create_performance_test_dataset(self, size, complexity='simple'):
        """Create dataset for performance testing"""
        
        conversations = []
        
        for i in range(size):
            conversation = self.create_therapeutic_conversation(
                complexity=complexity,
                include_phi=False,
                conversation_length=random.randint(3, 8)
            )
            conversations.extend(conversation)
        
        return {
            "id": f"performance_test_{size}_{complexity}",
            "conversations": conversations,
            "metadata": {
                "size": size,
                "complexity": complexity,
                "total_messages": len(conversations),
                "created_for": "performance_testing"
            }
        }
    
    def create_hipaa_test_scenarios(self):
        """Create test scenarios for HIPAA compliance testing"""
        
        scenarios = {
            'phi_detection': {
                'description': 'Various types of PHI in conversations',
                'data': [
                    {"role": "user", "content": "My name is John Smith, I'm 25 years old"},
                    {"role": "user", "content": "You can reach me at john.smith@email.com"},
                    {"role": "user", "content": "My phone number is 555-123-4567"},
                    {"role": "user", "content": "I live at 123 Main Street, Anytown, USA"},
                    {"role": "user", "content": "My social security number is 123-45-6789"}
                ]
            },
            'medical_information': {
                'description': 'Medical information that constitutes PHI',
                'data': [
                    {"role": "user", "content": "I've been diagnosed with bipolar disorder"},
                    {"role": "user", "content": "My psychiatrist prescribed lithium for my condition"},
                    {"role": "user", "content": "I have a history of depression in my family"},
                    {"role": "user", "content": "I'm currently taking antidepressants"}
                ]
            },
            'therapeutic_content': {
                'description': 'Legitimate therapeutic content without unnecessary PHI',
                'data': [
                    {"role": "user", "content": "I've been feeling anxious lately"},
                    {"role": "user", "content": "Work has been really stressful"},
                    {"role": "user", "content": "I'm having trouble sleeping"},
                    {"role": "user", "content": "I feel overwhelmed by daily tasks"}
                ]
            }
        }
        
        return scenarios
    
    def _load_conversation_templates(self):
        """Load conversation templates for realistic test data"""
        
        return {
            'initial_session': [
                ("user", "I've been struggling with anxiety and decided to try therapy"),
                ("assistant", "I'm glad you reached out. Taking the first step toward therapy shows courage. Can you tell me more about what brings you here today?"),
                ("user", "I feel anxious all the time, especially at work. It's affecting my performance"),
                ("assistant", "Work anxiety can be very challenging. Let's explore what's happening at work that's triggering these feelings.")
            ],
            'follow_up_session': [
                ("user", "Since our last session, I've been trying the breathing exercises you suggested"),
                ("assistant", "That's wonderful! How have the breathing exercises been working for you?"),
                ("user", "They help a bit, but I still feel anxious when I have presentations"),
                ("assistant", "Presentations can be particularly anxiety-provoking. Let's work on some specific strategies for that situation.")
            ],
            'crisis_support': [
                ("user", "I'm having really dark thoughts and I don't know what to do"),
                ("assistant", "I'm so sorry you're experiencing these dark thoughts. You're not alone in this. Have you been able to reach out to your support system?"),
                ("user", "I feel like a burden to everyone"),
                ("assistant", "I hear that you're feeling like a burden, and I want you to know that your life has value. These feelings, while overwhelming right now, can change with support.")
            ]
        }

# Fixture management
@pytest.fixture
def test_data_factory():
    """Provide test data factory to tests"""
    return TestDataFactory()

@pytest.fixture
def sample_therapeutic_conversation(test_data_factory):
    """Provide sample therapeutic conversation"""
    return test_data_factory.create_therapeutic_conversation()

@pytest.fixture
def sample_performance_dataset(test_data_factory):
    """Provide sample performance test dataset"""
    return test_data_factory.create_performance_test_dataset(1000)

@pytest.fixture
def malicious_dataset(test_data_factory):
    """Provide dataset with malicious content for security testing"""
    return test_data_factory.create_malicious_dataset('xss')
```

---

## Test Execution and Reporting

### Automated Test Execution Framework

```python
# tests/test_runner.py - Test execution and reporting framework
class TestRunner:
    """Manages test execution and reporting for TechDeck integration"""
    
    def __init__(self, config):
        self.config = config
        self.test_results = []
        self.coverage_analyzer = CoverageAnalyzer(config)
        self.performance_analyzer = PerformanceAnalyzer(config)
        self.security_analyzer = SecurityAnalyzer(config)
    
    async def run_test_suite(self, suite_name, test_categories=None):
        """Run specified test suite with comprehensive reporting"""
        
        test_categories = test_categories or ['unit', 'integration', 'e2e', 'performance', 'security']
        
        suite_results = {
            'suite_name': suite_name,
            'start_time': datetime.now(),
            'categories': {},
            'summary': {}
        }
        
        for category in test_categories:
            category_results = await self.run_test_category(category)
            suite_results['categories'][category] = category_results
        
        suite_results['end_time'] = datetime.now()
        suite_results['summary'] = self._generate_suite_summary(suite_results)
        
        // Generate comprehensive report
        report = await self.generate_test_report(suite_results)
        
        return report
    
    async def run_test_category(self, category):
        """Run tests for specific category"""
        
        category_config = self.config.TEST_CATEGORIES.get(category, {})
        
        // Configure pytest for this category
        pytest_args = [
            f"tests/{category}",
            "-v",
            "--tb=short",
            f"--html=reports/test_report_{category}.html",
            f"--junitxml=reports/test_results_{category}.xml"
        ]
        
        if category == 'performance':
            pytest_args.extend(["--performance", "--benchmark-only"])
        elif category == 'security':
            pytest_args.extend(["--security", "--security-tests"])
        
        // Run tests
        exit_code = pytest.main(pytest_args)
        
        // Collect results
        results = await self._collect_test_results(category)
        
        // Analyze specific aspects
        if category == 'unit':
            results['coverage'] = await self.coverage_analyzer.analyze_coverage()
        elif category == 'performance':
            results['performance_metrics'] = await self.performance_analyzer.analyze_performance()
        elif category == 'security':
            results['security_findings'] = await self.security_analyzer.analyze_security()
        
        return results
    
    async def generate_test_report(self, test_results):
        """Generate comprehensive test report"""
        
        report = {
            'report_id': str(uuid.uuid4()),
            'generated_at': datetime.now().isoformat(),
            'test_suite': test_results['suite_name'],
            'duration_seconds': (test_results['end_time'] - test_results['start_time']).total_seconds(),
            'summary': test_results['summary'],
            'detailed_results': {},
            'recommendations': []
        }
        
        // Add category-specific results
        for category, results in test_results['categories'].items():
            report['detailed_results'][category] = {
                'test_count': results.get('test_count', 0),
                'passed': results.get('passed', 0),
                'failed': results.get('failed', 0),
                'skipped': results.get('skipped', 0),
                'success_rate': results.get('success_rate', 0),
                'coverage': results.get('coverage', {}),
                'performance_metrics': results.get('performance_metrics', {}),
                'security_findings': results.get('security_findings', [])
            }
        
        // Generate recommendations
        report['recommendations'] = await self._generate_recommendations(test_results)
        
        // Save report
        await self._save_report(report)
        
        return report
    
    def _generate_suite_summary(self, results):
        """Generate high-level summary of test suite results"""
        
        total_tests = 0
        total_passed = 0
        total_failed = 0
        total_skipped = 0
        
        for category_results in results['categories'].values():
            total_tests += category_results.get('test_count', 0)
            total_passed += category_results.get('passed', 0)
            total_failed += category_results.get('failed', 0)
            total_skipped += category_results.get('skipped', 0)
        
        success_rate = (total_passed / max(total_tests, 1)) * 100
        
        return {
            'total_tests': total_tests,
            'total_passed': total_passed,
            'total_failed': total_failed,
            'total_skipped': total_skipped,
            'success_rate_percentage': success_rate,
            'status': 'PASSED' if success_rate >= 80 else 'FAILED'
        }
    
    async def _generate_recommendations(self, test_results):
        """Generate actionable recommendations based on test results"""
        
        recommendations = []
        
        // Analyze each category for issues
        for category, results in test_results['categories'].items():
            if results.get('failed', 0) > 0:
                recommendations.append({
                    'category': category,
                    'type': 'IMMEDIATE',
                    'priority': 'HIGH',
                    'description': f"Fix failing tests in {category} category",
                    'details': f"{results['failed']} tests are failing"
                })
            
            // Category-specific recommendations
            if category == 'performance':
                perf_metrics = results.get('performance_metrics', {})
                if perf_metrics.get('avg_response_time_ms', 0) > 1000:
                    recommendations.append({
                        'category': category,
                        'type': 'OPTIMIZATION',
                        'priority': 'MEDIUM',
                        'description': "Optimize API response times",
                        'details': f"Average response time is {perf_metrics['avg_response_time_ms']}ms"
                    })
            
            elif category == 'security':
                security_findings = results.get('security_findings', [])
                high_risk_findings = [f for f in security_findings if f.get('severity') == 'HIGH']
                if high_risk_findings:
                    recommendations.append({
                        'category': category,
                        'type': 'SECURITY',
                        'priority': 'CRITICAL',
                        'description': "Address high-risk security findings",
                        'details': f"{len(high_risk_findings)} high-risk security issues found"
                    })
            
            elif category == 'unit':
                coverage = results.get('coverage', {})
                if coverage.get('line_coverage_percentage', 0) < 80:
                    recommendations.append({
                        'category': category,
                        'type': 'QUALITY',
                        'priority': 'MEDIUM',
                        'description': "Improve test coverage",
                        'details': f"Line coverage is {coverage['line_coverage_percentage']}%"
                    })
        
        return recommendations
    
    async def _save_report(self, report):
        """Save test report to storage"""
        
        // Save to file system
        report_filename = f"test_report_{report['report_id']}.json"
        report_path = Path("reports") / report_filename
        
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        // Save to database for historical tracking
        await self._store_report_in_database(report)
        
        // Generate HTML report
        html_report = await self._generate_html_report(report)
        html_path = Path("reports") / f"test_report_{report['report_id']}.html"
        
        with open(html_path, 'w') as f:
            f.write(html_report)
        
        self.logger.info(f"Test report saved: {report_path}")
    
    async def _generate_html_report(self, report):
        """Generate HTML version of test report"""
        
        html_template = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>TechDeck Integration Test Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { background-color: #f0f0f0; padding: 20px; border-radius: 5px; }
                .summary { margin: 20px 0; }
                .category { margin: 20px 0; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
                .passed { color: green; }
                .failed { color: red; }
                .warning { color: orange; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .recommendations { background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>TechDeck-Python Pipeline Integration Test Report</h1>
                <p>Report ID: {report_id}</p>
                <p>Generated: {generated_at}</p>
                <p>Test Suite: {suite_name}</p>
                <p>Duration: {duration:.2f} seconds</p>
            </div>
            
            <div class="summary">
                <h2>Summary</h2>
                <p>Total Tests: {total_tests}</p>
                <p>Passed: <span class="passed">{passed}</span></p>
                <p>Failed: <span class="failed">{failed}</span></p>
                <p>Skipped: {skipped}</p>
                <p>Success Rate: {success_rate:.1f}%</p>
                <p>Overall Status: <span class="{status_class}">{status}</span></p>
            </div>
            
            {category_details}
            
            {recommendations_section}
        </body>
        </html>
        """
        
        // Format template with report data
        category_details = ""
        for category, data in report['detailed_results'].items():
            category_details += f"""
            <div class="category">
                <h3>{category.title()} Tests</h3>
                <p>Tests: {data['test_count']} | 
                   Passed: <span class="passed">{data['passed']}</span> | 
                   Failed: <span class="failed">{data['failed']}</span> | 
                   Skipped: {data['skipped']}</p>
                <p>Success Rate: {data['success_rate']:.1f}%</p>
            </div>
            """
        
        recommendations_section = ""
        if report['recommendations']:
            recommendations_section = "<div class='recommendations'><h2>Recommendations</h2><ul>"
            for rec in report['recommendations']:
                recommendations_section += f"<li><strong>{rec['priority']}:</strong> {rec['description']}</li>"
            recommendations_section += "</ul></div>"
        
        return html_template.format(
            report_id=report['report_id'],
            generated_at=report['generated_at'],
            suite_name=report['test_suite'],
            duration=report['duration_seconds'],
            total_tests=report['summary']['total_tests'],
            passed=report['summary']['total_passed'],
            failed=report['summary']['total_failed'],
            skipped=report['summary']['total_skipped'],
            success_rate=report['summary']['success_rate_percentage'],
            status=report['summary']['status'],
            status_class='passed' if report['summary']['status'] == 'PASSED' else 'failed',
            category_details=category_details,
            recommendations_section=recommendations_section
        )

# Test validation criteria
TEST_VALIDATION_CRITERIA = {
    'unit_tests': {
        'minimum_coverage': 80,
        'required_coverage_types': ['line', 'branch', 'function'],
        'max_execution_time_seconds': 300
    },
    'integration_tests': {
        'minimum_success_rate': 95,
        'max_execution_time_seconds': 600,
        'required_endpoints': [
            '/api/v1/datasets/upload',
            '/api/v1/pipelines/execute',
            '/api/v1/auth/login',
            '/api/v1/websocket/connect'
        ]
    },
    'e2e_tests': {
        'minimum_success_rate': 90,
        'critical_user_journeys': [
            'complete_dataset_pipeline_journey',
            'error_recovery_journey',
            'hipaa_compliance_journey'
        ]
    },
    'performance_tests': {
        'max_api_response_time_ms': 1000,
        'max_pipeline_execution_time_seconds': 30,
        'min_upload_speed_mbps': 1.0,
        'max_websocket_latency_ms': 100,
        'concurrent_user_support': 100
    },
    'security_tests': {
        'required_security_headers': [
            'X-Content-Type-Options',
            'X-Frame-Options',
            'X-XSS-Protection',
            'Strict-Transport-Security'
        ],
        'phi_detection_accuracy': 95,
        'encryption_coverage': 100,
        'audit_log_integrity': True
    }
}
```

This comprehensive testing strategy and validation criteria specification ensures enterprise-grade quality for the TechDeck-Python pipeline integration while maintaining HIPAA++ compliance and performance requirements.