#!/bin/bash
# Verification checklist for strict mode and pipeline execution implementation

set -e

echo "🔍 Verifying Strict Mode & Pipeline Execution Implementation"
echo "=============================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅${NC} $1"
        return 0
    else
        echo -e "${RED}❌${NC} $1 (MISSING)"
        return 1
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✅${NC} $1"
        return 0
    else
        echo -e "${RED}❌${NC} $1 (MISSING)"
        return 1
    fi
}

check_content() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✅${NC} $1 contains '$2'"
        return 0
    else
        echo -e "${RED}❌${NC} $1 missing '$2'"
        return 1
    fi
}

# Track failures
FAILURES=0

echo "📝 Checking Code Changes..."
echo ""

# Check strict mode defaults
if check_content "ai/pipelines/orchestrator/orchestration/integrated_training_pipeline.py" "fail_on_stage_drift: bool = True"; then
    :
else
    FAILURES=$((FAILURES + 1))
fi

if check_content "ai/pipelines/orchestrator/orchestration/integrated_training_pipeline.py" "fail_on_missing_stage_artifacts: bool ="; then
    :
else
    FAILURES=$((FAILURES + 1))
fi

# Check strict mode method exists
if check_content "ai/pipelines/orchestrator/orchestration/integrated_training_pipeline.py" "_apply_strict_mode_overrides"; then
    :
else
    FAILURES=$((FAILURES + 1))
fi

# Check strict mode is called in __init__
if check_content "ai/pipelines/orchestrator/orchestration/integrated_training_pipeline.py" "self._apply_strict_mode_overrides()"; then
    :
else
    FAILURES=$((FAILURES + 1))
fi

echo ""
echo "📄 Checking Documentation Files..."
echo ""

check_file "docs/TRAINING-QUICK-START.md"
FAILURES=$((FAILURES + $?))

check_file "docs/guides/developers/strict-mode-training.md"
FAILURES=$((FAILURES + $?))

check_file "docs/guides/developers/pipeline-execution-runbook.md"
FAILURES=$((FAILURES + $?))

check_file "docs/implementation-summary-2026-03-17.md"
FAILURES=$((FAILURES + $?))

echo ""
echo "🚀 Checking Execution Script..."
echo ""

check_file "scripts/run-integrated-training-pipeline.py"
FAILURES=$((FAILURES + $?))

if [ -f "scripts/run-integrated-training-pipeline.py" ]; then
    if check_content "scripts/run-integrated-training-pipeline.py" "def main"; then
        :
    else
        FAILURES=$((FAILURES + 1))
    fi
    
    if check_content "scripts/run-integrated-training-pipeline.py" "validate_output_artifacts"; then
        :
    else
        FAILURES=$((FAILURES + 1))
    fi
    
    if check_content "scripts/run-integrated-training-pipeline.py" "write_run_provenance"; then
        :
    else
        FAILURES=$((FAILURES + 1))
    fi
fi

echo ""
echo "📋 Checking Output Directories..."
echo ""

# These should exist after running the pipeline
if [ -d "ai/training_data_consolidated/final" ]; then
    echo -e "${GREEN}✅${NC} ai/training_data_consolidated/final (exists)"
else
    echo -e "${YELLOW}⚠️${NC} ai/training_data_consolidated/final (will be created by pipeline)"
fi

if [ -d "ai/lightning" ]; then
    echo -e "${GREEN}✅${NC} ai/lightning (exists)"
else
    echo -e "${YELLOW}⚠️${NC} ai/lightning (will be created by pipeline)"
fi

echo ""
echo "🔐 Checking Environment Variable Support..."
echo ""

if check_content "ai/pipelines/orchestrator/orchestration/integrated_training_pipeline.py" "TRAINING_STRICT_MODE"; then
    :
else
    FAILURES=$((FAILURES + 1))
fi

if check_content "ai/pipelines/orchestrator/orchestration/integrated_training_pipeline.py" "TRAINING_ALLOW_MISSING_ARTIFACTS"; then
    :
else
    FAILURES=$((FAILURES + 1))
fi

if check_content "ai/pipelines/orchestrator/orchestration/integrated_training_pipeline.py" "TRAINING_ALLOW_STAGE_DRIFT"; then
    :
else
    FAILURES=$((FAILURES + 1))
fi

echo ""
echo "=============================================================="
echo ""

if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED${NC}"
    echo ""
    echo "Ready to execute:"
    echo "  python scripts/run-integrated-training-pipeline.py"
    echo ""
    exit 0
else
    echo -e "${RED}❌ $FAILURES CHECK(S) FAILED${NC}"
    echo ""
    echo "Please review the failures above and ensure all files are in place."
    echo ""
    exit 1
fi
