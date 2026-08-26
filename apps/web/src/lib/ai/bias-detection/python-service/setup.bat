@echo off
REM Bias Detection Engine Python Service Setup Script (Windows)
REM This script sets up the Python environment and installs all required dependencies

setlocal enabledelayedexpansion

echo 🚀 Setting up Bias Detection Engine Python Service...

REM Check if Python is installed
echo [INFO] Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.8+ from https://python.org
    pause
    exit /b 1
)

REM Get Python version
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo [SUCCESS] Python %PYTHON_VERSION% found

REM Check if pip is installed
echo [INFO] Checking pip installation...
pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] pip not found. Please install pip
    pause
    exit /b 1
)
echo [SUCCESS] pip found

REM Remove existing virtual environment if it exists
if exist "venv" (
    echo [WARNING] Virtual environment already exists. Removing...
    rmdir /s /q venv
)

REM Create virtual environment
echo [INFO] Creating virtual environment...
python -m venv venv
if %errorlevel% neq 0 (
    echo [ERROR] Failed to create virtual environment
    pause
    exit /b 1
)
echo [SUCCESS] Virtual environment created

REM Activate virtual environment
echo [INFO] Activating virtual environment...
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo [ERROR] Failed to activate virtual environment
    pause
    exit /b 1
)
echo [SUCCESS] Virtual environment activated

REM Upgrade pip
echo [INFO] Upgrading pip...
python -m pip install --upgrade pip
if %errorlevel% neq 0 (
    echo [WARNING] Failed to upgrade pip, continuing...
)
echo [SUCCESS] pip upgraded

REM Install wheel and setuptools
echo [INFO] Installing build tools...
pip install wheel setuptools
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install build tools
    pause
    exit /b 1
)

REM Install dependencies from requirements.txt
echo [INFO] Installing Python dependencies...
if not exist "requirements.txt" (
    echo [ERROR] requirements.txt not found
    pause
    exit /b 1
)

pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo [SUCCESS] Dependencies installed from requirements.txt

REM Download spaCy model
echo [INFO] Downloading spaCy English model...
python -m spacy download en_core_web_sm
if %errorlevel% neq 0 (
    echo [WARNING] Failed to download spaCy model, continuing...
)
echo [SUCCESS] spaCy model downloaded

REM Download NLTK data
echo [INFO] Downloading NLTK data...
python -c "import nltk; nltk.download('vader_lexicon', quiet=True); nltk.download('punkt', quiet=True); nltk.download('stopwords', quiet=True); print('NLTK data downloaded successfully')"
if %errorlevel% neq 0 (
    echo [WARNING] Failed to download NLTK data, continuing...
)
echo [SUCCESS] NLTK data downloaded

REM Test installation
echo [INFO] Testing installation...
python -c "import sys; import importlib; packages = ['flask', 'numpy', 'pandas', 'sklearn', 'scipy', 'spacy', 'nltk', 'textblob', 'cryptography', 'jwt']; [importlib.import_module(p) for p in packages]; print('✅ Core dependencies test passed')"
if %errorlevel% neq 0 (
    echo [ERROR] Installation test failed
    pause
    exit /b 1
)
echo [SUCCESS] Installation test passed

REM Create environment file template
echo [INFO] Creating environment file template...
(
echo # Bias Detection Engine Environment Configuration
echo.
echo # Flask Configuration
echo FLASK_SECRET_KEY=your-secret-key-here
echo JWT_SECRET_KEY=your-jwt-secret-here
echo FLASK_ENV=development
echo.
echo # Encryption Configuration
echo ENCRYPTION_PASSWORD=your-encryption-password-here
echo ENCRYPTION_SALT=your-encryption-salt-here
echo.
echo # API Keys ^(add as needed^)
echo OPENAI_API_KEY=your-openai-key-here
echo HUGGINGFACE_API_KEY=your-huggingface-key-here
echo.
echo # Database Configuration ^(if needed^)
echo DATABASE_URL=sqlite:///bias_detection.db
echo.
echo # Logging Configuration
echo LOG_LEVEL=INFO
echo LOG_FILE=bias_detection.log
echo.
echo # Service Configuration
echo HOST=0.0.0.0
echo PORT=5000
echo DEBUG=false
) > .env.example

echo [SUCCESS] Environment template created (.env.example)
echo [WARNING] Please copy .env.example to .env and configure your settings

REM Create startup script
echo [INFO] Creating startup script...
(
echo @echo off
echo REM Bias Detection Engine Service Startup Script
echo.
echo REM Activate virtual environment
echo call venv\Scripts\activate.bat
echo.
echo REM Load environment variables ^(if .env exists^)
echo if exist .env ^(
echo     for /f "usebackq tokens=1,2 delims==" %%%%a in ^(".env"^) do ^(
echo         if not "%%%%a"=="" if not "%%%%a:~0,1"=="#" set %%%%a=%%%%b
echo     ^)
echo ^)
echo.
echo REM Start the service
echo echo Starting Bias Detection Engine Service...
echo python bias_detection_service.py
echo.
echo pause
) > start_service.bat

echo [SUCCESS] Startup script created (start_service.bat)

echo.
echo ==================================================
echo [SUCCESS] Setup completed successfully!
echo ==================================================
echo.
echo Next steps:
echo 1. Copy .env.example to .env and configure your settings
echo 2. Run start_service.bat to start the service
echo.
echo For development:
echo - Activate environment: venv\Scripts\activate.bat
echo - Run tests: pytest
echo - Format code: black .
echo - Lint code: flake8 .
echo.

pause 