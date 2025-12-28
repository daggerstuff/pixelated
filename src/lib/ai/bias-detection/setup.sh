#!/bin/bash

# Pixelated Empathy Bias Detection Engine Setup Script
# This script installs and configures all required dependencies for the bias detection system

set -e # Exit on any error

echo "🔍 Setting up Pixelated Empathy Bias Detection Engine..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
	echo -e "${BLUE}[INFO]${NC} $1"
}

print_warning() {
	echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
	echo -e "${RED}[ERROR]${NC} $1"
}

print_success() {
	echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if Python 3.8+ is available
check_python() {
	print_status "Checking Python version..."

	if command -v python3 &>/dev/null; then
		PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
		PYTHON_MAJOR=$(echo "${PYTHON_VERSION}" | cut -d. -f1)
		PYTHON_MINOR=$(echo "${PYTHON_VERSION}" | cut -d. -f2)

		if [[ ${PYTHON_MAJOR} -ge 3 ]] && [[ ${PYTHON_MINOR} -ge 8 ]]; then
			print_success "Python ${PYTHON_VERSION} found"
			PYTHON_CMD="python3"
		else
			print_error "Python 3.8+ required, found ${PYTHON_VERSION}"
			exit 1
		fi
	else
		print_error "Python 3 not found. Please install Python 3.8 or higher."
		exit 1
	fi
}

# Create virtual environment
create_venv() {
	print_status "Creating Python virtual environment with uv..."
	uv venv --python "${PYTHON_CMD}"
	print_success "Virtual environment created in .venv"

	# Activate virtual environment
	source .venv/bin/activate
	uv pip install pip
}

# Install core dependencies
install_core_dependencies() {
	print_status "Installing core Python dependencies with uv..."

	# Install requirements
	if [[ -f "requirements.txt" ]]; then
		uv pip install -r requirements.txt
		print_success "Core dependencies installed"
	else
		print_error "requirements.txt not found"
		exit 1
	fi
}

# Install and configure spaCy
setup_spacy() {
	print_status "Setting up spaCy..."

	# Download spaCy language model
	python -m spacy download en_core_web_sm
	python -m spacy download en_core_web_md # Medium model for better accuracy

	print_success "spaCy models downloaded"
}

# Install and configure NLTK
setup_nltk() {
	print_status "Setting up NLTK..."

	# Download NLTK data
	python -c "
import nltk
import ssl

try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

# Download required NLTK data
nltk.download('punkt')
nltk.download('stopwords')
nltk.download('wordnet')
nltk.download('vader_lexicon')
nltk.download('averaged_perceptron_tagger')
nltk.download('omw-1.4')
print('NLTK setup complete')
"

	print_success "NLTK data downloaded"
}

# Install AIF360 with dependencies
install_aif360() {
	print_status "Installing IBM AIF360 with uv..."

	# AIF360 has specific requirements
	uv pip install aif360

	# Install additional dependencies that might be needed
	uv pip install cvxpy
	uv pip install fairlearn

	print_success "AIF360 installed"
}

# Install Fairlearn
install_fairlearn() {
	print_status "Installing Microsoft Fairlearn with uv..."

	uv pip install fairlearn

	print_success "Fairlearn installed"
}

# Install What-If Tool
install_wit() {
	print_status "Installing Google What-If Tool with uv..."

	uv pip install witwidget

	print_success "What-If Tool installed"
}

# Install Hugging Face evaluate
install_hf_evaluate() {
	print_status "Installing Hugging Face evaluate with uv..."

	uv pip install evaluate
	uv pip install transformers[torch]

	print_success "Hugging Face evaluate installed"
}

# Install additional ML and visualization libraries
install_additional_libs() {
	print_status "Installing additional libraries with uv..."

	# Visualization and analysis
	uv pip install matplotlib seaborn plotly dash

	# Data processing and validation
	uv pip install great-expectations pandera

	# Model interpretability
	uv pip install shap lime

	# Development tools
	uv pip install pytest pytest-mock black flake8

	print_success "Additional libraries installed"
}

# Configure environment
configure_environment() {
	print_status "Configuring environment..."

	# Create .env template if it doesn't exist
	if [[ ! -f ".env.bias-detection" ]]; then
		cat >.env.bias-detection <<EOF
# Bias Detection Engine Configuration
BIAS_DETECTION_SERVICE_PORT=8080
BIAS_DETECTION_LOG_LEVEL=INFO
BIAS_DETECTION_ENABLE_HIPAA=true
BIAS_DETECTION_ENABLE_AUDIT=true

# Thresholds
BIAS_WARNING_THRESHOLD=0.3
BIAS_HIGH_THRESHOLD=0.6
BIAS_CRITICAL_THRESHOLD=0.8

# External services (optional)
SLACK_WEBHOOK_URL=
EMAIL_SMTP_SERVER=
EMAIL_USERNAME=
EMAIL_PASSWORD=

# Database (optional - for metrics storage)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=pixelated_bias_detection
POSTGRES_USER=
POSTGRES_PASSWORD=
EOF
		print_success "Environment configuration template created"
	else
		print_warning "Environment configuration already exists"
	fi
}

# Create directory structure
create_directories() {
	print_status "Creating directory structure..."

	mkdir -p logs
	mkdir -p data/cache
	mkdir -p data/models
	mkdir -p reports
	mkdir -p tests

	print_success "Directory structure created"
}

# Run basic tests
run_tests() {
	print_status "Running basic tests..."

	# Test Python imports
	python -c "
import sys
import traceback

required_modules = [
    'numpy', 'pandas', 'sklearn', 'matplotlib', 'seaborn', 'plotly',
    'spacy', 'nltk', 'textblob', 'evaluate', 'transformers'
]

optional_modules = [
    'aif360', 'fairlearn', 'witwidget', 'shap', 'lime'
]

print('Testing required modules...')
for module in required_modules:
    try:
        __import__(module)
        print(f'✓ {module}')
    except ImportError as e:
        print(f'✗ {module}: {e}')
        sys.exit(1)

print('\nTesting optional modules...')
for module in optional_modules:
    try:
        __import__(module)
        print(f'✓ {module}')
    except ImportError as e:
        print(f'△ {module}: {e} (optional)')

print('\nTesting spaCy model...')
try:
    import spacy
    nlp = spacy.load('en_core_web_sm')
    doc = nlp('This is a test sentence.')
    print('✓ spaCy model loaded successfully')
except Exception as e:
    print(f'✗ spaCy model test failed: {e}')
    sys.exit(1)

print('\nTesting NLTK...')
try:
    from nltk.sentiment import SentimentIntensityAnalyzer
    analyzer = SentimentIntensityAnalyzer()
    scores = analyzer.polarity_scores('This is a positive sentence.')
    print('✓ NLTK sentiment analyzer working')
except Exception as e:
    print(f'✗ NLTK test failed: {e}')
    sys.exit(1)

print('\n🎉 All tests passed!')
"

	if [[ $? -eq 0 ]]; then
		print_success "Basic tests passed"
	else
		print_error "Some tests failed"
		exit 1
	fi
}

# Create service startup script
create_service_script() {
	print_status "Creating service startup script..."

	cat >start_bias_detection_service.sh <<'EOF'
#!/bin/bash

# Bias Detection Service Startup Script

# Activate virtual environment
source .venv/bin/activate

# Load environment variables
if [ -f ".env.bias-detection" ]; then
    export $(cat .env.bias-detection | grep -v '#' | xargs)
fi

# Start the bias detection service with Gunicorn
echo "Starting Bias Detection Service with Gunicorn..."
gunicorn --workers 4 --bind ${BIAS_SERVICE_HOST:-127.0.0.1}:${BIAS_SERVICE_PORT:-5001} "start-python-service:app"

EOF

	chmod +x start_bias_detection_service.sh
	print_success "Service startup script created"
}

# Main installation flow
main() {
	echo "🚀 Starting Pixelated Empathy Bias Detection Engine Setup"
	echo "=================================================="

	# Change to the bias-detection directory
	cd "$(dirname "$0")"

	check_python
	create_venv
	install_core_dependencies
	setup_spacy
	setup_nltk
	install_aif360
	install_fairlearn
	install_wit
	install_hf_evaluate
	install_additional_libs
	configure_environment
	create_directories
	run_tests
	create_service_script

	echo ""
	echo "=================================================="
	print_success "🎉 Bias Detection Engine setup completed successfully!"
	echo ""
	echo "Next steps:"
	echo "1. Review and configure .env.bias-detection file"
	echo "2. Run: source .venv/bin/activate"
	echo "3. Start the service: ./start_bias_detection_service.sh"
	echo ""
	echo "For more information, see the documentation at:"
	echo "docs/bias-detection-engine.md"
}

# Handle script interruption
trap 'print_error "Setup interrupted by user"; exit 1' INT

# Run main function
main "$@"
