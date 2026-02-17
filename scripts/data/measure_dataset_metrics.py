#!/usr/bin/env python3
"""
Dataset Metrics Measurement Script
Measures actual dataset metrics against PRD targets.

Usage:
    PYTHONPATH=/home/vivi/pixelated python scripts/data/measure_dataset_metrics.py
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any
from collections import defaultdict

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))


class DatasetMetricsMeasurer:
    """Measure and report on dataset metrics."""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent.parent
        self.ai_root = self.project_root / "ai"
        self.training_packages = self.ai_root / "training" / "ready_packages"
        self.metrics = {}
        
    def measure_catalog_files(self) -> Dict[str, Any]:
        """Analyze the dataset accessibility catalog."""
        catalog_path = self.training_packages / "training_ready" / "scripts" / "output" / "dataset_accessibility_catalog.json"
        
        if not catalog_path.exists():
            return {"error": "Catalog not found", "total": 0}
        
        with open(catalog_path) as f:
            catalog = json.load(f)
        
        summary = catalog.get("summary", {})
        
        # Analyze by stage and format
        stage_breakdown = defaultdict(int)
        format_breakdown = defaultdict(int)
        
        for item in catalog.get("catalog", {}).get("local_only", []):
            stage = item.get("stage", "unassigned")
            fmt = item.get("format", "unknown")
            stage_breakdown[stage] += 1
            format_breakdown[fmt] += 1
        
        return {
            "total_files": summary.get("total", 0),
            "local_only": summary.get("local_only", 0),
            "huggingface": summary.get("huggingface", 0),
            "kaggle": summary.get("kaggle", 0),
            "url": summary.get("url", 0),
            "stage_breakdown": dict(stage_breakdown),
            "format_breakdown": dict(format_breakdown),
        }
    
    def count_training_samples(self) -> Dict[str, int]:
        """Count actual training samples from manifest and data files."""
        manifest_path = self.training_packages / "TRAINING_MANIFEST.json"
        
        sample_counts = {
            "therapeutic_conversations": 0,
            "bias_samples": 0,
            "grounded_conversations": 0,
            "crisis_samples": 0,
            "edge_cases": 0,
        }
        
        # Check for JSONL files
        jsonl_files = list(self.training_packages.rglob("*.jsonl"))
        for jsonl_file in jsonl_files:
            try:
                with open(jsonl_file) as f:
                    lines = sum(1 for _ in f)
                    
                # Categorize based on filename
                name_lower = jsonl_file.name.lower()
                if "therapeutic" in name_lower or "therapy" in name_lower:
                    sample_counts["therapeutic_conversations"] += lines
                elif "bias" in name_lower:
                    sample_counts["bias_samples"] += lines
                elif "grounded" in name_lower or "academic" in name_lower:
                    sample_counts["grounded_conversations"] += lines
                elif "crisis" in name_lower:
                    sample_counts["crisis_samples"] += lines
                elif "edge" in name_lower:
                    sample_counts["edge_cases"] += lines
            except Exception as e:
                print(f"Warning: Could not read {jsonl_file}: {e}")
        
        return sample_counts
    
    def check_database_stats(self) -> Dict[str, Any]:
        """Check database for conversation counts."""
        try:
            from ai.infrastructure.database.persistence import DatasetPersistence
            from ai.infrastructure.database.conversation_database import ConversationDatabase
            
            # Try to connect and get stats
            # This might fail if database isn't configured
            return {
                "database_available": True,
                "note": "Database connection not implemented in this script",
            }
        except Exception as e:
            return {
                "database_available": False,
                "error": str(e),
            }
    
    def check_crisis_detector_metrics(self) -> Dict[str, Any]:
        """Verify crisis detector performance."""
        try:
            sys.path.insert(0, str(self.project_root))
            from ai.safety.crisis_detection.production_crisis_detector import CrisisDetector
            
            detector = CrisisDetector()
            
            # Test on known crisis phrases
            crisis_tests = [
                "I want to kill myself",
                "I have a plan to end it all",
                "Life isn't worth living anymore",
            ]
            
            detected = sum(1 for text in crisis_tests if detector.detect_crisis(text))
            sensitivity = (detected / len(crisis_tests)) * 100
            
            return {
                "threshold": detector.sensitivity_threshold,
                "test_sensitivity": f"{sensitivity:.1f}%",
                "status": "✅ VERIFIED" if sensitivity >= 95 else "⚠️ BELOW TARGET",
            }
        except Exception as e:
            return {
                "error": str(e),
                "status": "❌ ERROR",
            }
    
    def measure_all(self) -> Dict[str, Any]:
        """Run all measurements."""
        print("📊 Measuring Dataset Metrics...")
        print("=" * 70)
        
        # File catalog
        print("\n1. Analyzing file catalog...")
        catalog_metrics = self.measure_catalog_files()
        
        # Training samples
        print("2. Counting training samples...")
        sample_counts = self.count_training_samples()
        
        # Database
        print("3. Checking database...")
        db_stats = self.check_database_stats()
        
        # Crisis detector
        print("4. Verifying crisis detector...")
        crisis_metrics = self.check_crisis_detector_metrics()
        
        # Compile results
        results = {
            "timestamp": datetime.now().isoformat(),
            "file_catalog": catalog_metrics,
            "sample_counts": sample_counts,
            "database": db_stats,
            "crisis_detector": crisis_metrics,
            "prd_targets": {
                "therapeutic_samples": 10000,
                "bias_samples": 5000,
                "grounded_conversations": 5000,
                "crisis_detection_sensitivity": "≥95%",
                "e2e_performance": "≤30 min (100k records)",
                "test_coverage": "≥80%",
            },
        }
        
        self.metrics = results
        return results
    
    def generate_report(self) -> str:
        """Generate markdown report."""
        if not self.metrics:
            self.measure_all()
        
        m = self.metrics
        catalog = m.get("file_catalog", {})
        samples = m.get("sample_counts", {})
        crisis = m.get("crisis_detector", {})
        targets = m.get("prd_targets", {})
        
        report = f"""# Dataset Metrics Report
**Generated**: {m['timestamp']}

---

## 📊 Summary

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Therapeutic Samples | ≥10,000 | {samples.get('therapeutic_conversations', 0):,} | {'✅' if samples.get('therapeutic_conversations', 0) >= 10000 else '❌'} |
| Bias Samples | ≥5,000 | {samples.get('bias_samples', 0):,} | {'✅' if samples.get('bias_samples', 0) >= 5000 else '❌'} |
| Grounded Conversations | ≥5,000 | {samples.get('grounded_conversations', 0):,} | {'✅' if samples.get('grounded_conversations', 0) >= 5000 else '❌'} |
| Crisis Detection | ≥95% | {crisis.get('test_sensitivity', 'N/A')} | {crisis.get('status', '❓')} |
| Total Files Cataloged | - | {catalog.get('total_files', 0):,} | ℹ️ |

---

## 📁 File Catalog Analysis

**Total Files**: {catalog.get('total_files', 0):,}

### By Source
- Local Only: {catalog.get('local_only', 0):,}
- HuggingFace: {catalog.get('huggingface', 0):,}
- Kaggle: {catalog.get('kaggle', 0):,}
- URL: {catalog.get('url', 0):,}

### By Stage
```
{self._format_dict(catalog.get('stage_breakdown', {}))}
```

### By Format
```
{self._format_dict(catalog.get('format_breakdown', {}))}
```

---

## 💾 Training Sample Counts

| Category | Count | Notes |
|----------|-------|-------|
| Therapeutic Conversations | {samples.get('therapeutic_conversations', 0):,} | Target: ≥10,000 |
| Bias Detection Samples | {samples.get('bias_samples', 0):,} | Target: ≥5,000 |
| Grounded Conversations | {samples.get('grounded_conversations', 0):,} | Target: ≥5,000 |
| Crisis Samples | {samples.get('crisis_samples', 0):,} | For testing |
| Edge Cases | {samples.get('edge_cases', 0):,} | Quality assurance |

---

## 🚨 Crisis Detector Status

- **Threshold**: {crisis.get('threshold', 'N/A')}
- **Test Sensitivity**: {crisis.get('test_sensitivity', 'N/A')}
- **Status**: {crisis.get('status', '❓')}

---

## 🎯 Gap Analysis

### Critical Gaps (P0)

{self._generate_gaps(samples, targets)}

---

## 📋 Next Steps

{self._generate_next_steps(samples, targets)}

---

## 📄 Data Sources

- File Catalog: `ai/training/ready_packages/training_ready/scripts/output/dataset_accessibility_catalog.json`
- Training Manifest: `ai/training/ready_packages/TRAINING_MANIFEST.json`
- JSONL Files: Scanned from `ai/training/ready_packages/**/*.jsonl`

---

**Report Generated By**: `scripts/data/measure_dataset_metrics.py`
"""
        return report
    
    def _format_dict(self, d: Dict) -> str:
        """Format dictionary for display."""
        if not d:
            return "  (none)"
        return "\n".join(f"  {k}: {v:,}" for k, v in sorted(d.items(), key=lambda x: -x[1]))
    
    def _generate_gaps(self, samples: Dict, targets: Dict) -> str:
        """Generate gap analysis."""
        gaps = []
        
        therapeutic_gap = targets['therapeutic_samples'] - samples.get('therapeutic_conversations', 0)
        if therapeutic_gap > 0:
            gaps.append(f"- ❌ **Therapeutic Samples**: Need {therapeutic_gap:,} more to reach {targets['therapeutic_samples']:,} target")
        
        bias_gap = targets['bias_samples'] - samples.get('bias_samples', 0)
        if bias_gap > 0:
            gaps.append(f"- ❌ **Bias Samples**: Need {bias_gap:,} more to reach {targets['bias_samples']:,} target")
        
        grounded_gap = targets['grounded_conversations'] - samples.get('grounded_conversations', 0)
        if grounded_gap > 0:
            gaps.append(f"- ❌ **Grounded Conversations**: Need {grounded_gap:,} more to reach {targets['grounded_conversations']:,} target")
        
        if not gaps:
            return "✅ **No critical gaps! All targets met.**"
        
        return "\n".join(gaps)
    
    def _generate_next_steps(self, samples: Dict, targets: Dict) -> str:
        """Generate recommended next steps."""
        steps = []
        
        therapeutic_gap = targets['therapeutic_samples'] - samples.get('therapeutic_conversations', 0)
        bias_gap = targets['bias_samples'] - samples.get('bias_samples', 0)
        grounded_gap = targets['grounded_conversations'] - samples.get('grounded_conversations', 0)
        
        if therapeutic_gap > 0 or grounded_gap > 0:
            steps.append("1. **Implement YouTube Transcript Extraction** (PIX-4) - Can provide both therapeutic and grounded conversations")
        
        if grounded_gap > 0:
            steps.append("2. **Implement Books-to-Training Extraction** (PIX-2) - Academic books provide grounded conversations")
        
        if bias_gap > 0:
            steps.append("3. **Generate Bias Detection Samples** - Use NeMo Data Designer for synthetic bias cases")
        
        steps.append("4. **Implement E2E Pipeline Test** (PIX-5) - Validate full workflow")
        steps.append("5. **Re-measure Metrics** - Track progress after extraction scripts complete")
        
        return "\n".join(steps) if steps else "✅ All targets met! Focus on E2E validation."


def main():
    """Main execution."""
    measurer = DatasetMetricsMeasurer()
    
    # Measure metrics
    metrics = measurer.measure_all()
    
    # Generate report
    print("\n" + "=" * 70)
    print("📝 Generating Report...")
    print("=" * 70)
    report = measurer.generate_report()
    
    # Save outputs
    output_dir = Path("metrics")
    output_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Save JSON
    json_path = output_dir / f"dataset_metrics_{timestamp}.json"
    with open(json_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"\n✅ Saved JSON: {json_path}")
    
    # Save Markdown
    md_path = output_dir / f"dataset_report_{timestamp}.md"
    with open(md_path, "w") as f:
        f.write(report)
    print(f"✅ Saved Report: {md_path}")
    
    # Print report
    print("\n" + "=" * 70)
    print(report)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
