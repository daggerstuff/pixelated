# Therapeutic AI API - Status Dashboard

**Status**: 🟢 **ONLINE**  
**Host**: `${THERAPEUTIC_API_HOST}`  
**Port**: `${THERAPEUTIC_API_PORT}`  
**Mode**: CPU-only  
**Framework**: Flask + PyTorch + Fairlearn  
**Data Models**: Pydantic (Type-safe)

**⚠️ SECURITY NOTICE**: This service implements clinical decision support with
crisis detection capabilities. All risk assessments and escalation protocols
must include:

- Explainability for all risk level determinations
- Clinician override capabilities
- Clear intended-use documentation
- Confidence threshold indicators
- Comprehensive audit trails

---

## 🔗 Endpoints

| Endpoint                             | Method | Purpose                             |  Status   |
| :----------------------------------- | :----: | :---------------------------------- | :-------: |
| `/health`                            |  GET   | System status & version             | ✅ Active |
| `/api/security/scrub-pii`            |  POST  | Redact sensitive data (HIPAA)       | ✅ Active |
| `/api/security/detect-crisis`        |  POST  | Analyze inputs for harm/distress    | ✅ Active |
| `/api/emotion/validate`              |  POST  | Verify emotion detection integrity  | ✅ Active |
| `/api/bias/analyze-session`          |  POST  | Detect demographic bias in sessions | ✅ Active |
| `/api/combined/analyze-conversation` |  POST  | Run all analyses in one call        | ✅ Active |

---

## 🛠️ Service Details

### **1. PII Scrubbing**

- **Categories**: Names, Emails, Phones, SSN, Addresses
- **Method**: Regex + Contextual Analysis
- **Masking**: Placeholder replacement (e.g., `[NAME]`)

### **2. Crisis Detection**

- **Signals**: Self-harm, Violence, Despair, Substance Abuse, Medical
- **Output**: Risk Level (Minimal → Imminent) + Escalation Protocol
- **Safeguards**: Intended as decision support only; requires clinician
  review/override. Provide explainability, confidence thresholds, and audit
  logging before any escalation.
- **Clinical Safeguards**:
  - **Explainability**: All risk determinations include clear reasoning and
    contributing factors
  - **Clinician Override**: All automated decisions can be overridden by
    qualified clinicians
  - **FDA/CE Intended Use**: Clearly documented for clinical decision support,
    not diagnosis
  - **Confidence Thresholds**: Risk levels include confidence percentages and
    uncertainty indicators
  - **Audit Trail**: Comprehensive logging of all risk assessments and
    interventions
- **Performance**: <100ms response time

### **3. Emotion Validation**

- **Checks**: Consistency, Contextual Appropriateness, Authenticity
- **Integration**: Cross-references with participant demographics
- **Bias Check**: Flags gendered emotional stereotypes

### **4. Bias Detection** (Fairlearn)

- **Metrics**: Demographic Parity, Equalized Odds
- **Protected Groups**: Gender, Age, Ethnicity
- **Analysis**: Scans transcripts + AI responses for stereotypical language

---

## 🚀 Usage

```bash
# Activation
source ~/pixelated/.venv/bin/activate
cd ~/pixelated/ai-services
bash start-api.sh

# Testing
bash test-api.sh
```

---

_Last Updated: 2026-01-24_
