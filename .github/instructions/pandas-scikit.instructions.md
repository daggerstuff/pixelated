---
applyTo: '**/*.py,**/*.ipynb,**/ai/**/*,**/dataset_pipeline/**/*,**/models/**/*'
description: 'Pandas and scikit-learn data/ML guidelines for Pixelated Empathy'
---

# Data Analysis & ML Guidelines for Pixelated Empathy

## Core Principles

- **Privacy-First**: All data analysis must comply with HIPAA++ requirements and zero-knowledge architecture
- **Bias Detection**: Integrate bias monitoring in all ML pipelines and data transformations
- **Reproducibility**: Ensure all analyses are reproducible with proper seed management and environment control
- **Performance**: Optimize for <50ms inference times in production ML models
- **Security**: Encrypt sensitive therapeutic data at rest and in transit

## Project Structure Alignment

```python
# Follow established project structure
ai/
├── dataset_pipeline/     # Data processing and preparation
├── models/              # ML model definitions and training  
├── inference/           # Model inference services
├── monitoring/          # Quality and performance monitoring
├── safety/              # Safety validation and compliance
└── api/                 # Python API services
```

## Data Handling Standards

### Therapeutic Data Processing
```python
# Always validate therapeutic data integrity
def validate_therapeutic_data(df: pd.DataFrame) -> pd.DataFrame:
    """Validate therapeutic session data with privacy checks."""
    required_cols = ['session_id', 'timestamp', 'interaction_type']
    assert all(col in df.columns for col in required_cols)
    
    # Remove any PII that shouldn't be present
    df = df.drop(columns=[col for col in df.columns if 'pii' in col.lower()])
    
    # Validate data types and ranges
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df[df['timestamp'] > '2020-01-01']  # Reasonable date range
    
    return df
```

### Bias Detection Integration
```python
from ai.safety.bias_detection import BiasDetectionEngine

def analyze_with_bias_monitoring(df: pd.DataFrame, analysis_func: callable) -> dict:
    """Wrap analysis functions with bias detection."""
    bias_detector = BiasDetectionEngine()
    
    # Pre-analysis bias check
    bias_detector.check_input_bias(df)
    
    # Perform analysis
    results = analysis_func(df)
    
    # Post-analysis bias validation
    bias_report = bias_detector.validate_results(results)
    
    return {
        'analysis_results': results,
        'bias_report': bias_report,
        'compliance_status': bias_report.get('compliant', False)
    }
```

## ML Model Development

### Model Architecture Patterns
```python
# Use consistent model interfaces
class TherapeuticMLModel:
    def __init__(self, config: dict):
        self.config = config
        self.bias_detector = BiasDetectionEngine()
        
    def preprocess(self, data: pd.DataFrame) -> np.ndarray:
        """Standardized preprocessing with bias checks."""
        # Implement FHE-compatible preprocessing
        pass
        
    def train(self, X: np.ndarray, y: np.ndarray) -> None:
        """Training with bias monitoring."""
        # Monitor for bias during training
        self.bias_detector.monitor_training(X, y)
        
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Inference with <50ms latency requirement."""
        start_time = time.time()
        predictions = self._predict_impl(X)
        
        inference_time = (time.time() - start_time) * 1000
        assert inference_time < 50, f"Inference too slow: {inference_time}ms"
        
        return predictions
```

### Performance Optimization
```python
# Use efficient data structures for large datasets
def optimize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Optimize DataFrame memory usage for therapeutic data."""
    # Convert object columns to categorical where appropriate
    for col in df.select_dtypes(include=['object']):
        if df[col].nunique() / len(df) < 0.5:  # Less than 50% unique values
            df[col] = df[col].astype('category')
    
    # Downcast numeric types
    df = df.select_dtypes(include=['int']).apply(pd.to_numeric, downcast='integer')
    df = df.select_dtypes(include=['float']).apply(pd.to_numeric, downcast='float')
    
    return df
```

## Visualization & Reporting

### Therapeutic Data Visualization
```python
import matplotlib.pyplot as plt
import seaborn as sns

def create_therapeutic_dashboard(df: pd.DataFrame) -> None:
    """Create HIPAA-compliant therapeutic data visualizations."""
    # Use accessible color schemes
    sns.set_palette("colorblind")
    
    fig, axes = plt.subplots(2, 2, figsize=(12, 8))
    
    # Session distribution (anonymized)
    df.groupby('session_type').size().plot(kind='bar', ax=axes[0,0])
    axes[0,0].set_title('Session Type Distribution')
    
    # Temporal patterns
    df.set_index('timestamp').resample('D').size().plot(ax=axes[0,1])
    axes[0,1].set_title('Daily Session Volume')
    
    # Ensure no PII in visualizations
    plt.suptitle('Therapeutic Data Analysis (Anonymized)')
    plt.tight_layout()
```

## Quality Assurance

### Data Validation Pipeline
```python
def comprehensive_data_validation(df: pd.DataFrame) -> dict:
    """Comprehensive validation for therapeutic datasets."""
    validation_report = {
        'shape': df.shape,
        'missing_data': df.isnull().sum().to_dict(),
        'data_types': df.dtypes.to_dict(),
        'privacy_compliance': True,  # Implement actual privacy checks
        'bias_metrics': {},  # Implement bias detection
        'quality_score': 0.0
    }
    
    # Check for PII leakage
    pii_patterns = ['email', 'phone', 'ssn', 'name']
    for col in df.columns:
        if any(pattern in col.lower() for pattern in pii_patterns):
            validation_report['privacy_compliance'] = False
            
    # Calculate quality score
    missing_ratio = df.isnull().sum().sum() / (df.shape[0] * df.shape[1])
    validation_report['quality_score'] = 1.0 - missing_ratio
    
    return validation_report
```

## Environment & Dependencies

### Required Packages
```python
# Core data science stack
pandas>=2.0.0
numpy>=1.24.0
scikit-learn>=1.3.0
matplotlib>=3.7.0
seaborn>=0.12.0

# Performance optimization
dask>=2023.5.0
numba>=0.57.0

# Privacy and security
cryptography>=41.0.0
homomorphic-encryption>=0.1.0  # Custom FHE implementation

# Bias detection and monitoring
fairlearn>=0.9.0
aif360>=0.5.0
```

### Development Workflow
1. **Data Ingestion**: Validate and encrypt all incoming therapeutic data
2. **Exploratory Analysis**: Use bias-aware analysis functions
3. **Model Development**: Implement with privacy-preserving techniques
4. **Validation**: Comprehensive bias and privacy compliance testing
5. **Deployment**: Ensure <50ms inference times and audit trail logging

## Compliance Requirements

- **HIPAA++ Compliance**: All data handling must exceed standard HIPAA requirements
- **Audit Trails**: Log all data access and transformations
- **Bias Monitoring**: Real-time bias detection in all ML pipelines
- **Privacy Preservation**: Use FHE for sensitive computations
- **Performance Standards**: <50ms response times for production models