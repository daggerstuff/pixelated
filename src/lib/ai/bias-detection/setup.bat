@echo off
echo ===== Pixelated Empathy Bias Detection Engine Setup =====
echo.

REM Check Python version
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    exit /b 1
)

REM Get Python version and check if it's 3.8+
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo Python version detected: %PYTHON_VERSION%

REM Create virtual environment
echo Creating Python virtual environment...
python -m venv bias_detection_env
if errorlevel 1 (
    echo ERROR: Failed to create virtual environment
    exit /b 1
)

REM Activate virtual environment
echo Activating virtual environment...
call bias_detection_env\Scripts\activate.bat

REM Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip

REM Install core dependencies first
echo Installing core dependencies...
pip install numpy pandas scikit-learn

REM Install IBM AIF360
echo Installing IBM AIF360...
pip install aif360

REM Install Microsoft Fairlearn
echo Installing Microsoft Fairlearn...
pip install fairlearn

REM Install Google What-If Tool
echo Installing Google What-If Tool...
pip install witwidget

REM Install Hugging Face evaluate
echo Installing Hugging Face evaluate...
pip install evaluate

REM Install NLP libraries
echo Installing NLP libraries...
pip install spacy nltk textblob

REM Install visualization libraries
echo Installing visualization libraries...
pip install matplotlib seaborn plotly dash

REM Install additional ML libraries
echo Installing additional ML libraries...
pip install shap lime

REM Install data validation libraries
echo Installing data validation libraries...
pip install great-expectations pandera

REM Install development tools
echo Installing development tools...
pip install pytest black flake8

REM Download spaCy models
echo Downloading spaCy language models...
python -m spacy download en_core_web_sm

REM Download NLTK data
echo Downloading NLTK data...
python -c "import nltk; nltk.download('vader_lexicon'); nltk.download('punkt'); nltk.download('stopwords'); nltk.download('wordnet')"

REM Test installation
echo Testing installation...
python -c "import aif360, fairlearn, spacy, nltk, evaluate; print('All major libraries imported successfully!')"

echo.
echo ===== Setup Complete! =====
echo Virtual environment created in: bias_detection_env
echo To activate the environment, run: bias_detection_env\Scripts\activate.bat
echo. 