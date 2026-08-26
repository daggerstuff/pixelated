# Clinical AI Dataset Research Catalog

> **Date**: 2026-08-04  
> **Scope**: Datasets for clinical AI training — pathology detection,
> longitudinal therapy, adversarial benchmarking  
> **Ethics**: Published/consented research datasets only. No scraping private
> clinical forums or unconsented accounts.

---

## Domain 1: Complex Clinical Pathologies (8 datasets)

### 1.1 DAIC-WOZ / E-DAIC

| Field           | Value                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **URL**         | https://dcapswoz.ict.usc.edu/                                                                                                           |
| **Size**        | 189 sessions                                                                                                                            |
| **Pathologies** | PTSD, depression                                                                                                                        |
| **Format**      | Transcripts (CSV) + Audio (WAV) + Features                                                                                              |
| **Labels**      | PHQ-8, PCL-C                                                                                                                            |
| **License**     | Academic (USC)                                                                                                                          |
| **Modality**    | Multi-modal: text + audio                                                                                                               |
| **Integration** | ClinicalBERT tokenization + wav2vec2.0 audio encoder + multi-modal fusion. PHQ-8 → depression severity scoring. PCL-C → PTSD screening. |

### 1.2 CLPsych Shared Tasks

| Field           | Value                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **URL**         | https://clpsych.org/shared-task/                                                                                                        |
| **Size**        | Varies per task year                                                                                                                    |
| **Pathologies** | Suicide risk, ABCD self-states, ADHD symptoms (2026)                                                                                    |
| **Format**      | JSON (Reddit posts + annotations)                                                                                                       |
| **Labels**      | 2024: suicide risk evidence (125 users, r/SuicideWatch). 2025: ABCD (Affect/Behavior/Cognition/Desire). 2026: ADHD symptom ranking.     |
| **License**     | Research                                                                                                                                |
| **Integration** | Social media signal detection. ABCD labels → multi-state behavior classification. 2026 ADHD task → ADHD+addiction comorbidity pipeline. |

### 1.3 eRisk (CLEF)

| Field           | Value                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL**         | https://erisk.irlab.org/                                                                                                                           |
| **Size**        | Multi-task benchmark                                                                                                                               |
| **Pathologies** | Depression, anorexia, self-harm, pathological gambling, ADHD (2026 NEW)                                                                            |
| **Format**      | JSON sequential social media posts                                                                                                                 |
| **Labels**      | Binary risk + BDI-II ranking + ADHD symptom ranking                                                                                                |
| **Metric**      | ERDE (Early Risk Detection Error) — latency-aware                                                                                                  |
| **License**     | Research (CLEF)                                                                                                                                    |
| **Integration** | Sequential risk detection. ERDE metric → time-to-detection evaluation. 2026 ADHD task → comorbidity signal. BDI-II ranking → severity calibration. |

### 1.4 BBRD (BPD and Behaviour Reddit Dataset)

| Field           | Value                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **URL**         | https://research.lancaster-university.uk/en/datasets/bpd-and-behaviour-reddit-dataset-bbrd/                                                                  |
| **Size**        | 992 BPD users, 68,590 posts (2011–2023), 17K manually annotated                                                                                              |
| **Pathologies** | BPD, suicidality, self-harm, substance use                                                                                                                   |
| **Format**      | Reddit posts + manual annotations                                                                                                                            |
| **Labels**      | Suicidality, self-harm, substance use, therapy behaviors                                                                                                     |
| **License**     | CC BY-NC (non-commercial)                                                                                                                                    |
| **Integration** | Longitudinal BPD trajectory tracking. Recovery arcs. 17K annotated posts → supervised behavior classification. 12-year span → temporal progression modeling. |

### 1.5 PersonalityDBench

| Field           | Value                                                                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL**         | https://aclanthology.org/2026.acl-long.1395/                                                                                                                            |
| **Size**        | PRISMA + PersonaDSteering                                                                                                                                               |
| **Pathologies** | Personality disorders (DSM criteria)                                                                                                                                    |
| **Format**      | JSON                                                                                                                                                                    |
| **Labels**      | Clinically annotated social media + DSM criteria. PersonaDSteering: LLM steering benchmark for PD-consistent persona generation.                                        |
| **License**     | Academic (ACL 2026)                                                                                                                                                     |
| **Integration** | PRISMA → PD symptom extraction from social text. PersonaDSteering → controlled persona generation for simulation training. DSM criteria → structured diagnosis mapping. |

### 1.6 machine_learning_BPD (DBT Treatment Outcomes)

| Field           | Value                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **URL**         | https://github.com/saidejp/machine_learning_BPD                                                                                         |
| **Size**        | ~30–50 BPD patients                                                                                                                     |
| **Pathologies** | BPD (DBT treatment)                                                                                                                     |
| **Format**      | CSV (impulsivity BIS-11, symptom severity)                                                                                              |
| **Labels**      | Pre/post DBT measures                                                                                                                   |
| **License**     | Research (GitHub)                                                                                                                       |
| **Integration** | DBT treatment outcome prediction. BIS-11 impulsivity → treatment response features. Random forest baseline → treatment personalization. |

### 1.7 BoPD (EHR Screening Tool)

| Field           | Value                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **URL**         | https://github.com/BoPDdiseasescreening/Borderline-Personality-Disorder-BoPD-automatic-disease-screening-tool                |
| **Size**        | 456 patients                                                                                                                 |
| **Pathologies** | BPD (EHR screening)                                                                                                          |
| **Format**      | SQL + Python                                                                                                                 |
| **Labels**      | ICD-10-CM codes                                                                                                              |
| **Performance** | AUROC 0.837                                                                                                                  |
| **License**     | Open (GitHub)                                                                                                                |
| **Integration** | EHR-based screening pipeline. ICD-10-CM code extraction → structured diagnosis. SQL queries → EHR data integration patterns. |

### 1.8 Mental Disorders Identification Reddit NLP (Kaggle)

| Field           | Value                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| **URL**         | https://www.kaggle.com/datasets/kamaruladha/mental-disorders-identification-reddit-nlp                            |
| **Size**        | Multi-disorder Reddit posts                                                                                       |
| **Pathologies** | Multiple disorders                                                                                                |
| **Format**      | CSV (posts + labels)                                                                                              |
| **Labels**      | Multi-class disorder classification                                                                               |
| **License**     | Public (Kaggle)                                                                                                   |
| **Integration** | Multi-disorder text classification baseline. Large-scale social media NLP. Pre-labeled → rapid training pipeline. |

### Access-Limited Sources

| Source            | URL             | Access                 |
| ----------------- | --------------- | ---------------------- |
| NIMH Data Archive | nda.nih.gov     | Institutional approval |
| ABCD Study        | abcdstudy.org   | Data use agreement     |
| OpenNeuro         | openneuro.org   | Open (neuroimaging)    |
| ICPSR             | icpsr.umich.edu | Institutional          |
| Zenodo            | zenodo.org      | Open (varies)          |
| OSF               | osf.io          | Open (varies)          |

---

## Domain 2: Longitudinal Therapy Architectures (7 datasets)

### 2.1 AnnoMI (Motivational Interviewing Annotated)

| Field           | Value                                                                                                                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL**         | https://github.com/uccollab/AnnoMI                                                                                                                                                                                                                                     |
| **HuggingFace** | https://huggingface.co/datasets/to-be/annomi-motivational-interviewing-therapy-conversations                                                                                                                                                                           |
| **Size**        | 133 MI transcripts, 9,699 utterances, 10 topics                                                                                                                                                                                                                        |
| **Format**      | CSV (AnnoMI-simple.csv + AnnoMI-full.csv), ShareGPT on HF                                                                                                                                                                                                              |
| **Labels**      | `mi_quality` (high/low), `main_therapist_behaviour` (reflection/question/therapist_input/other), `client_talk_type` (change/neutral/sustain). Full adds: annotator_id, therapist_input subtypes, reflection subtypes (simple/complex), question subtypes (open/closed) |
| **License**     | Public Domain (GDPR compliant)                                                                                                                                                                                                                                         |
| **Paper**       | ICASSP 2022, Future Internet 2023                                                                                                                                                                                                                                      |
| **Integration** | MI quality classification baseline. Therapist behavior prediction. Client talk-type detection. Therapy quality scoring for Pixelated Empathy.                                                                                                                          |

### 2.2 ESConv (Emotional Support Conversation)

| Field           | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL**         | https://github.com/thu-coai/Emotional-Support-Conversation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **ConvKit**     | https://convokit.cornell.edu/documentation/support.html                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **HuggingFace** | PierreCarcellerMeunier/ESConv                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Size**        | 1,300 conversations, 38,365 utterances, 2,600 speakers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Format**      | JSON (ESConv.json + FailedESConv.json: 196 negative samples)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Labels**      | 12 problem categories: ongoing depression (351), breakup (239), job crisis (280), friends (179), academic (156), procrastination (13), alcohol abuse (12), parent issues (18), sleep (28), appearance anxiety (12), school bullying (2), children (10). 8 support strategies: Questions (20.7%), Self-disclosure (9.3%), Affirmation/Reassurance (15.4%), Providing Suggestions (16.1%), Other (18.3%), Reflection of feelings (7.8%), Information (6.6%), Restatement/Paraphrasing (5.9%). Pre/post emotion intensity (1–5), empathy score, relevance score. |
| **Framework**   | ESC: Exploration → Comforting → Action (3-stage, 8 strategies). Grounded in Hill's Helping Skills Theory.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Quality**     | Trained supporters, 78.5% auto-approval. Emotion intensity before 4.04 → after 2.14.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **License**     | Research                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Paper**       | ACL 2021                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Integration** | Emotional support strategy classification. Empathy scoring. Emotion trajectory tracking. FailedESConv → adversarial/negative examples for safety training.                                                                                                                                                                                                                                                                                                                                                                                                    |

### 2.3 MEMO (Mental hEalth suMmarizatOn)

| Field           | Value                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL**         | https://github.com/LCS2-IIITD/MEMO                                                                                                                                     |
| **Size**        | 12,900 utterances from 212 counseling conversations (extends HOPE)                                                                                                     |
| **Format**      | CSV with counseling component annotations                                                                                                                              |
| **Labels**      | 4 psychotherapy elements: `symptom_and_history`, `patient_discovery`, `reflecting`, `discussion_filler`. Plus expert-annotated counseling summaries.                   |
| **Metric**      | MHIC (Mental Health Information Capture) — novel evaluation metric                                                                                                     |
| **Model**       | ConSum — domain-enriched transformer with PHQ-9 knowledge infusion + discussion filler classifier + counseling component classifier                                    |
| **License**     | Research (not for commercialization)                                                                                                                                   |
| **Paper**       | KDD 2022                                                                                                                                                               |
| **Integration** | Counseling summarization. Utterance-level psychotherapy element classification. ConSum PHQ-9 module → clinical assessment pipeline. MHIC → summary quality evaluation. |

### 2.4 MI-TAGS (MI Transcripts Annotated with Global Scores)

| Field           | Value                                                                                                                                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL**         | https://github.com/Advanced-Reality-Lab/MI-TAGS                                                                                                                                                                                          |
| **Access**      | https://advanced-reality-lab.github.io/MI-TAGS/ (request form)                                                                                                                                                                           |
| **Zenodo**      | 10.5281/zenodo.12792622                                                                                                                                                                                                                  |
| **Size**        | 242 MI demonstration transcripts                                                                                                                                                                                                         |
| **Format**      | CSV (sample in repo, full via access request)                                                                                                                                                                                            |
| **Labels**      | Utterance-level: 11 MITI 4.2 behavioral codes (10 standard + `structure_statement`). Session-level: 4 global scores — Empathy, SofteningSustainTalk, CultivatingChangeTalk, Partnership (5-point Likert). Client speech: CLEAR 1.0 tags. |
| **Topics**      | Smoking cessation, alcohol, substance abuse, weight management, medication adherence                                                                                                                                                     |
| **License**     | Request-based academic access                                                                                                                                                                                                            |
| **Paper**       | LREC-COLING 2024 (Best Paper nominee)                                                                                                                                                                                                    |
| **Integration** | MITI code automation. Global score prediction. Therapist performance evaluation. Directly maps to Real-Time Bias Detection for MI fidelity scoring.                                                                                      |

### 2.5 HOPE (Base for MEMO)

| Field           | Value                                                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL**         | https://github.com/LCS2-IIITD/SPARTA_WSDM2022 (HOPE_data/ folder)                                                                                                                                  |
| **Access**      | Google Form + email to aseems@iiitd.ac.in                                                                                                                                                          |
| **Size**        | 12,900 utterances, 212 counseling sessions                                                                                                                                                         |
| **Format**      | CSV with DAC labels                                                                                                                                                                                |
| **Labels**      | 12 Dialogue-Act Classification labels in 3 categories: speaker initiative (IRQ, YNQ, CRQ), speaker responsive (PA, NA, CD), general/mixed (ID, ACK, GC, QO, DA, OK). Dyadic (therapist + patient). |
| **Topics**      | CBT, child therapy, family therapy (YouTube-sourced)                                                                                                                                               |
| **License**     | Request-based academic                                                                                                                                                                             |
| **Paper**       | WSDM 2022                                                                                                                                                                                          |
| **Integration** | Dialogue-act classification for therapy conversations. Speaker-aware contextual modeling. SPARTA architecture (speaker + time-aware transformer) as baseline.                                      |

### 2.6 DMTCorpus (DMT-CBT) — SYNTHETIC

| Field           | Value                                                                                                                                                                                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL**         | arxiv 2606.03132                                                                                                                                                                                                                                                                                           |
| **Size**        | 4,317 retained sessions from 768 case-style conditions, 6 sessions per condition                                                                                                                                                                                                                           |
| **Format**      | Multi-session multimodal (text + image-grounded behaviors)                                                                                                                                                                                                                                                 |
| **Structure**   | Cross-session homework continuity, CBT treatment progression. 148 complete CBT cases from PsychEval, 383 homework items.                                                                                                                                                                                   |
| **Generation**  | GPT-4.1-mini                                                                                                                                                                                                                                                                                               |
| **License**     | Synthetic (to be released)                                                                                                                                                                                                                                                                                 |
| **Paper**       | arxiv 2026                                                                                                                                                                                                                                                                                                 |
| **Integration** | **LONGITUDINAL STATE TRACKING** — directly addresses Foresight Continuity. Cross-session memory propagation. Homework revisiting. Delayed intervention tracking. Hierarchical memory: incremental within-session + cross-session state propagation. **Best match for multi-session therapy architecture.** |

### 2.7 PsyDial — PRIVACY-PRESERVING

| Field           | Value                                                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL**         | ACL 2025: https://aclanthology.org/2025.acl-long.1049                                                                                                                                              |
| **Size**        | 2,382 long-term counseling dialogues, avg 37.8 turns/dialogue                                                                                                                                      |
| **Format**      | JSON dialogues (reconstructed)                                                                                                                                                                     |
| **Method**      | RMRR (Retrieve, Mask, Reconstruct, Refine) — retrieves chief complaints from PsyQA, masks all client utterances, reconstructs with GPT-4o, refines counselor utterances. Expert counselor audited. |
| **License**     | Privacy-preserving (client data masked/reconstructed)                                                                                                                                              |
| **Paper**       | ACL 2025                                                                                                                                                                                           |
| **Integration** | Privacy-preserving long-term dialogue generation. RMRR methodology → FHE-based HIPAA pipeline. Can reconstruct training data without exposing real patient utterances.                             |

### Longitudinal Therapy Integration Pipeline

```
HOPE/AnnoMI (single-session foundation)
    │
    ▼
MEMO (utterance-level psychotherapy elements)
    │
    ▼
ESConv (strategy + emotion tracking)
    │
    ▼
MI-TAGS (MITI fidelity scoring)
    │
    ▼
DMTCorpus (multi-session state propagation → Foresight Continuity)
    │
    ▼
PsyDial (privacy-preserving reconstruction → FHE pipeline)
```

| Component        | Datasets             | Role                                                      |
| ---------------- | -------------------- | --------------------------------------------------------- |
| Session-level    | AnnoMI + MI-TAGS     | MI quality scoring + therapist behavior classification    |
| Utterance-level  | MEMO + HOPE + ESConv | Psychotherapy elements + DAC labels + strategy annotation |
| Emotion tracking | ESConv + DMTCorpus   | Pre/post surveys + affective trajectories across sessions |
| Multi-session    | DMTCorpus            | Cross-session state → Foresight Continuity module         |
| Privacy          | PsyDial              | RMRR → FHE pipeline for HIPAA-compliant training data     |
| Summarization    | MEMO (ConSum + MHIC) | Session summaries for clinician review                    |

---

## Domain 3: Adversarial Benchmarking (10 sources)

### 3.1 VERA-MH (Spring Health)

| Field           | Value                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **URL**         | https://github.com/SpringCare/VERA-MH                                                                                                                              |
| **Papers**      | arxiv 2602.05088 (reliability/validity), arxiv 2510.15297 (concept)                                                                                                |
| **Type**        | Test suite / evaluation framework                                                                                                                                  |
| **Scope**       | Suicidal ideation safety — 100 clinically-developed personas, 5-dimension rubric                                                                                   |
| **Rubric**      | Detects Risk, Confirms Risk, Guides to Human Care, Supportive Conversation, Follows AI Boundaries                                                                  |
| **Pipeline**    | LLM-as-patient → LLM-as-provider → LLM-as-judge. Personas parameterize demographic + clinical risk factors. Judge calibrated against human clinicians (IRR study). |
| **Integration** | Swap provider model, vary persona pool, adjust severity thresholds. Directly parameterizable.                                                                      |

### 3.2 MHSafeEval (ACL 2026)

| Field           | Value                                                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL**         | https://huggingface.co/datasets/Suhyunlee/MHSafeEval                                                                                                            |
| **Paper**       | https://aclanthology.org/2026.findings-acl.1382.pdf                                                                                                             |
| **Type**        | Adversarial multi-turn evaluation framework + dataset                                                                                                           |
| **Scope**       | 7 harm categories × 4 counselor roles (Perpetrator, Instigator, Facilitator, Enabler) across depression, delusion, psychosis                                    |
| **Structure**   | Closed-loop agent-based adversarial discovery. QD (quality-diversity) grid: 7×4. Adaptive mutation. Severity 1–5. Validated (κ=0.327–0.387, recall 91.5–95.2%). |
| **Integration** | `main.py` + `harm_trigger_agent.py` + `judge.py`. Sweeps models × disorders × retry budgets. Directly usable as stress-test harness.                            |

### 3.3 SIM-VAIL (Vulnerability-Amplifying Interaction Loops)

| Field           | Value                                                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL**         | arxiv 2602.01347                                                                                                                                                                                   |
| **Type**        | Simulation-based auditing framework + published dataset                                                                                                                                            |
| **Scope**       | 30 psychiatric user phenotypes × 9 consumer chatbots × 13 risk dimensions. 810 conversations, 90K+ turn-level ratings.                                                                             |
| **Key Finding** | VAILs — locally supportive chatbot behaviors align with vulnerability-congruent mechanisms, causing risk to amplify over turns. Risk is phenotype-dependent, multivariate, accumulates over turns. |
| **Integration** | Open-source harness + dataset. Phenotype grid sweep. Turn-level multi-dimensional scoring.                                                                                                         |

### 3.4 MIT Media Lab — Simulating Psychological Risks

| Field                | Value                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **URL**              | https://github.com/mitmedialab/ai-psychosis                                                                                                                                          |
| **Paper**            | arxiv 2511.08880                                                                                                                                                                     |
| **Type**             | Dataset + taxonomy + methodology                                                                                                                                                     |
| **Scope**            | 6 conditions (addiction, anorexia, depression, homicide, psychosis, suicide), 18 real-world harm cases → 2,160 simulated scenarios, 157,054 turns across 4 LLMs                      |
| **Failure Taxonomy** | 51,693 harmful responses → 15 failure patterns in 4 categories. Clinical staging models (Stage 0–N per condition).                                                                   |
| **Files**            | `harmful-responses.csv` + `taxonomy.csv` + scenario JSONs                                                                                                                            |
| **Integration**      | Real-case-informed simulation. Personas vary demographics, contexts, interaction dynamics. Clinical staging parameterizes escalation. **Best source for Nightmare Fuel Simulation.** |

### 3.5 EMPATH (Multilingual Auditor–Judge Benchmark)

| Field              | Value                                                                                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL**            | arxiv 2606.30256                                                                                                                                                                                          |
| **Type**           | Benchmark + measurement instrument                                                                                                                                                                        |
| **Scope**          | 19 metrics across 5 dimensions: crisis handling, therapeutic quality, conversational integrity, emotional safety, cultural adaptation. 140 seed instructions + 34 personas. Mexican Spanish + US English. |
| **Key Innovation** | Cross-family judge calibration (auditor ≠ judge model family). Strict per-criterion rubric reveals score inflation on 10/19 metrics. Test-retest reliability measured.                                    |
| **Integration**    | Config-driven: pluggable targets, locale, turn budget, judge model. Cross-cultural safety evaluation.                                                                                                     |

### 3.6 Clinical AI Red Teaming Framework (Steenstra et al.)

| Field             | Value                                                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL**           | arxiv 2602.19948                                                                                                                                      |
| **Type**          | Methodology + large-scale audit                                                                                                                       |
| **Scope**         | Alcohol Use Disorder — 15 patient personas (DSM-5 phenotypes), 6 AI psychotherapists, 369 sessions                                                    |
| **Ontology**      | Quality of Care and Risk Ontology                                                                                                                     |
| **Failure Modes** | "AI Psychosis" (validation of patient delusions), failure to de-escalate suicide risk, cumulative iatrogenic harm invisible to single-turn benchmarks |
| **Integration**   | Multi-agent simulation: AI psychotherapist + simulated patient with dynamic cognitive-affective models. Between-session adverse outcome tracking.     |

### 3.7 Mental Health Crisis Benchmark (JMIR Mental Health 2026)

| Field           | Value                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **URL**         | https://ellisalicante.org/datasets/mental-health-crisis-llms/                                                                       |
| **GitHub**      | https://github.com/ellisalicante/mental-health-crisis-llms                                                                          |
| **Type**        | Benchmark dataset + response evaluation                                                                                             |
| **Scope**       | 2,252 curated user inputs from 12 Hugging Face datasets, 7 crisis categories. 5 LLMs audited, 30,660 responses, 91,980 evaluations. |
| **Structure**   | Crisis taxonomy → classification benchmark → response generation → LLM-as-judge (5-point Likert). Human-validated.                  |
| **Integration** | Directly loadable from Hugging Face. Crisis classification + response safety scoring.                                               |

### 3.8 MentalBench-Align

| Field             | Value                                                                                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL**           | https://github.com/abeerbadawi/MentalBench-Align                                                                                                                                                          |
| **Paper**         | arxiv 2510.19032                                                                                                                                                                                          |
| **Type**          | Large-scale benchmark + evaluation framework                                                                                                                                                              |
| **Scope**         | 10,000 therapeutic dialogues × 10 responses (1 human + 9 LLMs) = 100,000 pairs. 70,000 ratings across 7 attributes (Cognitive Support Score + Affective Resonance Score). 3 human experts + 4 LLM judges. |
| **Failure Modes** | Systematic LLM judge inflation (+0.4–0.8 on affective attributes). Safety & Relevance show poor reliability. ICC-based reliability classification (Good/Moderate/Limited).                                |
| **Integration**   | Dual-axis evaluation. ICC + bootstrap CIs for judge calibration. Response quality benchmarking.                                                                                                           |

### 3.9 Psychosis-Bench

| Field           | Value                                                                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL**         | https://github.com/w-is-h/psychosis-bench                                                                                                                                                       |
| **Type**        | Lightweight Python test library                                                                                                                                                                 |
| **Scope**       | 16 test cases across 6 delusion themes (grandiose, attachment/erotic, referential). 3 metrics: DCS (Delusion Confirmation Score), HES (Harm Enablement Score), SIS (Safety Intervention Score). |
| **Structure**   | Explicit + implicit variants per theme. Pluggable model backends. Batch async execution. ResultAnalyzer with export (JSON/CSV/Excel).                                                           |
| **Integration** | Minimal, directly integrable as CI gate. `run_batch_async(cases, models)`.                                                                                                                      |

### 3.10 Clinical Testing Tool (Multiphasic Labs)

| Field           | Value                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **URL**         | https://github.com/multiphasic-labs/clinical-testing-tool                                                                                                          |
| **Type**        | Pre-deployment CLI safety tester                                                                                                                                   |
| **Scope**       | 8 scripted personas (passive/active ideation, anxiety, diagnosis-seeking, lonely venting, overwhelmed, adversarial). Multi-criterion judge.                        |
| **Structure**   | Pluggable SUT backends (Anthropic, OpenAI, custom HTTP). Batch runs with pass/fail stats. Cached SUT responses. Weighted scoring. Redact mode for auditor sharing. |
| **Integration** | **Directly usable as CI gate.** `--persona`, `--sut`, `--criteria`, `--live` flags.                                                                                |

### Adversarial Benchmarking Parameterization Matrix

| Source                | Parameterizable Axes                                           | Integration Method                                  |
| --------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| VERA-MH               | Persona pool (100), rubric dimensions (5), severity thresholds | Swap provider model, vary persona sampling          |
| MHSafeEval            | Disorder type, counselor role, mutation strategy, retry budget | `--disorder_type`, `--model`, `--mutation_strategy` |
| SIM-VAIL              | User phenotype (30), conversational intent, chatbot target     | Open-source harness, phenotype grid sweep           |
| MIT ai-psychosis      | Clinical condition (6), stage (0–N), demographic               | Scenario JSONs + `harmful-responses.csv`            |
| EMPATH                | Locale, seed instructions (140), personas (34), metrics (19)   | Config-driven: target provider, locale, turn budget |
| Clinical Red Teaming  | Patient persona (15), cognitive-affective model params         | Multi-agent simulation framework                    |
| Crisis Benchmark      | Crisis category (7), user input (2,252), LLM target            | Hugging Face dataset + evaluation pipeline          |
| MentalBench-Align     | 23 conditions, 7 attributes, ICC reliability class             | Dataset + judge calibration framework               |
| Psychosis-Bench       | Delusion theme (6), explicit/implicit, model backend           | `run_batch_async(cases, models)`                    |
| Clinical Testing Tool | Persona (7), criteria, SUT backend, judge model                | `--persona`, `--sut`, `--criteria`, `--live`        |

---

## Integration Map → Pixelated Empathy Modules

| PE Module                                        | Datasets/Sources                                                                 | Integration Path                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Foresight Continuity** (longitudinal memory)   | DMTCorpus + HOPE/MEMO                                                            | DMTCorpus cross-session state propagation → MCP memory schema. HOPE/MEMO utterance labels → session-level context encoding.            |
| **Nightmare Fuel Simulation** (edge case engine) | MIT ai-psychosis (51K harmful responses) + SIM-VAIL + FailedESConv               | Failure taxonomy → adversarial scenario generation. VAIL patterns → escalation trajectories. FailedESConv → negative therapy examples. |
| **Real-Time Bias Detection**                     | MI-TAGS (MITI fidelity) + ESConv (strategy classification) + EMPATH (19 metrics) | MITI codes → bias signals. ESConv strategy distribution → deviation detection. EMPATH → cross-cultural bias flags.                     |
| **FHE/HIPAA Pipeline**                           | PsyDial (RMRR) + DAIC-WOZ                                                        | RMRR methodology → privacy-preserving training data reconstruction. DAIC-WOZ audio → multi-modal under FHE.                            |
| **CI Safety Gates**                              | Clinical Testing Tool + Psychosis-Bench + MHSafeEval                             | Pre-deployment persona sweeps. Psychosis-Bench batch tests. MHSafeEval multi-turn harm discovery.                                      |
| **Clinical Assessment** (PHQ-9, GAD-7)           | MEMO (ConSum+PHQ-9) + DAIC-WOZ (PHQ-8) + eRisk (BDI-II)                          | Validated scale infusion. MEMO's PHQ-9 knowledge module → assessment scoring.                                                          |

---

## Ethical Compliance

- **All sources**: Published/consented research datasets only
- **BBRD**: CC BY-NC (non-commercial use only)
- **DMTCorpus**: Synthetic — no real patient data
- **PsyDial**: Privacy-preserving RMRR — client utterances masked/reconstructed
- **Access-limited sources** (NIMH, ABCD, OpenNeuro): Require institutional
  approval
- **Compliance skill**: `health-data-dpia` installed for GDPR Art. 9 / HIPAA
  compliance checking

---

## Installed Research Skills

| Skill                              | Lines | Purpose                                                                             |
| ---------------------------------- | ----- | ----------------------------------------------------------------------------------- |
| `crisis-detection-intervention-ai` | 550   | NLP crisis detection, suicide ideation patterns, escalation protocols               |
| `psychology-research`              | 33    | References: DAIC-WOZ, GoEmotions, MentalBERT. Scales: PHQ-9, GAD-7, BDI-II, MMSE    |
| `academic-research`                | 229   | Exa MCP + ArXiv MCP. 5-tier escalation: ArXiv→Exa→Firecrawl→Obscura→Scrapling       |
| `health-data-dpia`                 | 127   | GDPR Art. 9 health data, HIPAA crosswalk, EU CTR 536/2014 clinical trial compliance |

---

_Research conducted 2026-08-04. 25 datasets/sources across 3 domains. Findings
stored in Foresight memory (b19414b17c87f6e3)._
