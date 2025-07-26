#!/bin/bash

# Bias Detection Engine Python Service Setup Script (Unix/Linux/macOS)
# This script sets up the Python environment and installs all required dependencies

set -e # Exit on any error

echo "🚀 Setting up Bias Detection Engine Python Service..."

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

print_success() {
	echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
	echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
	echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Python 3.8+ is installed
check_python() {
	print_status "Checking Python installation..."

	if command -v python3 &>/dev/null; then
		PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
		PYTHON_MAJOR=$(echo "${PYTHON_VERSION}" | cut -d. -f1)
		PYTHON_MINOR=$(echo "${PYTHON_VERSION}" | cut -d. -f2)

		if [[ ${PYTHON_MAJOR} -eq 3 ]] && [[ ${PYTHON_MINOR} -ge 8 ]]; then
			print_success "Python ${PYTHON_VERSION} found"
			PYTHON_CMD="python3"
		else
			print_error "Python 3.8+ required, found ${PYTHON_VERSION}"
			exit 1
		fi
	elif command -v python &>/dev/null; then
		PYTHON_VERSION=$(python -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
		PYTHON_MAJOR=$(echo "${PYTHON_VERSION}" | cut -d. -f1)
		PYTHON_MINOR=$(echo "${PYTHON_VERSION}" | cut -d. -f2)

		if [[ ${PYTHON_MAJOR} -eq 3 ]] && [[ ${PYTHON_MINOR} -ge 8 ]]; then
			print_success "Python ${PYTHON_VERSION} found"
			PYTHON_CMD="python"
		else
			print_error "Python 3.8+ required, found ${PYTHON_VERSION}"
			exit 1
		fi
	else
		print_error "Python not found. Please install Python 3.8+"
		exit 1
	fi
}

# Check if pip is installed
check_pip() {
	print_status "Checking pip installation..."

	if command -v pip3 &>/dev/null; then
		print_success "pip3 found"
		PIP_CMD="pip3"
	elif command -v pip &>/dev/null; then
		print_success "pip found"
		PIP_CMD="pip"
	else
		print_error "pip not found. Please install pip"
		exit 1
	fi
}

# Create virtual environment
create_venv() {
	print_status "Creating virtual environment..."

	if [[ -d "venv" ]]; then
		print_warning "Virtual environment already exists. Removing..."
		rm -rf venv
	fi

	${PYTHON_CMD} -m venv venv
	print_success "Virtual environment created"
}

# Activate virtual environment
activate_venv() {
	print_status "Activating virtual environment..."
	source venv/bin/activate
	print_success "Virtual environment activated"
}

# Upgrade pip
upgrade_pip() {
	print_status "Upgrading pip..."
	pip install --upgrade pip
	print_success "pip upgraded"
}

# Install system dependencies (if needed)
install_system_deps() {
	print_status "Checking system dependencies..."

	# Check for required system packages
	if command -v apt-get &>/dev/null; then
		# Ubuntu/Debian
		print_status "Detected apt package manager"
		sudo apt-get update
		sudo apt-get install -y python3-dev build-essential libssl-dev libffi-dev
	elif command -v yum &>/dev/null; then
		# CentOS/RHEL
		print_status "Detected yum package manager"
		sudo yum install -y python3-devel gcc openssl-devel libffi-devel
	elif command -v brew &>/dev/null; then
		# macOS with Homebrew
		print_status "Detected Homebrew package manager"
		brew install openssl libffi
	else
		print_warning "Could not detect package manager. You may need to install development tools manually."
	fi
}

# Install Python dependencies
install_dependencies() {
	print_status "Installing Python dependencies..."

	# Install core dependencies first
	pip install wheel setuptools

	# Install requirements
	if [[ -f "requirements.txt" ]]; then
		pip install -r requirements.txt
		print_success "Dependencies installed from requirements.txt"
	else
		print_error "requirements.txt not found"
		exit 1
	fi
}

# Download spaCy model
download_spacy_model() {
	print_status "Downloading spaCy English model..."

	python -m spacy download en_core_web_sm
	print_success "spaCy model downloaded"
}

# Download NLTK data
download_nltk_data() {
	print_status "Downloading NLTK data..."

	python -c "
import nltk
try:
    nltk.download('vader_lexicon', quiet=True)
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
    print('NLTK data downloaded successfully')
except Exception as e:
    print(f'Error downloading NLTK data: {e}')
    "
	print_success "NLTK data downloaded"
}

# Test installation
test_installation() {
	print_status "Testing installation..."

	python -c "
import sys
import importlib

# Test core dependencies
packages = [
    'flask', 'numpy', 'pandas', 'sklearn', 'scipy',
    'spacy', 'nltk', 'textblob', 'cryptography', 'jwt'
]

optional_packages = [
    'aif360', 'fairlearn', 'evaluate', 'transformers', 
    'shap', 'lime', 'matplotlib', 'seaborn', 'plotly'
]

print('Testing core dependencies...')
for package in packages:
    try:
        importlib.import_module(package)
        print(f'✓ {package}')
    except ImportError as e:
        print(f'✗ {package}: {e}')
        sys.exit(1)

print('\nTesting optional dependencies...')
for package in optional_packages:
    try:
        importlib.import_module(package)
        print(f'✓ {package}')
    except ImportError as e:
        print(f'⚠ {package}: {e} (optional)')

print('\n✅ Installation test completed successfully!')
"

	if [[ $? -eq 0 ]]; then
		print_success "Installation test passed"
	else
		print_error "Installation test failed"
		exit 1
	fi
}

# Create environment file template
create_env_template() {
	print_status "Creating environment file template..."

	cat >.env.example <<EOF
# Bias Detection Engine Environment Configuration

# Flask Configuration
FLASK_SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-here
FLASK_ENV=development

# Encryption Configuration
ENCRYPTION_PASSWORD=your-encryption-password-here
ENCRYPTION_SALT=your-encryption-salt-here

# API Keys (add as needed)
OPENAI_API_KEY=your-openai-key-here
HUGGINGFACE_API_KEY=your-huggingface-key-here

# Database Configuration (if needed)
DATABASE_URL=sqlite:///bias_detection.db

# Logging Configuration
LOG_LEVEL=INFO
LOG_FILE=bias_detection.log

# Service Configuration
HOST=0.0.0.0
PORT=5000
DEBUG=false
EOF

	print_success "Environment template created (.env.example)"
	print_warning "Please copy .env.example to .env and configure your settings"
}

# Create startup script
create_startup_script() {
	print_status "Creating startup script..."

	cat >start_service.sh <<'EOF'
#!/bin/bash

# Bias Detection Engine Service Startup Script

# Activate virtual environment
source venv/bin/activate

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Start the service
echo "Starting Bias Detection Engine Service..."
python bias_detection_service.py
EOF

	chmod +x start_service.sh
	print_success "Startup script created (start_service.sh)"
}

# Main setup function
main() {
	echo "=================================================="
	echo "  Bias Detection Engine Python Service Setup"
	echo "=================================================="

	# Change to script directory
	cd "$(dirname "$0")"

	# Run setup steps
	check_python
	check_pip
	install_system_deps
	create_venv
	activate_venv
	upgrade_pip
	install_dependencies
	download_spacy_model
	download_nltk_data
	test_installation
	create_env_template
	create_startup_script

	echo ""
	echo "=================================================="
	print_success "Setup completed successfully!"
	echo "=================================================="
	echo ""
	echo "Next steps:"
	echo "1. Copy .env.example to .env and configure your settings"
	echo "2. Activate the virtual environment: source venv/bin/activate"
	echo "3. Start the service: ./start_service.sh"
	echo ""
}

# Run main function
main "$@"
