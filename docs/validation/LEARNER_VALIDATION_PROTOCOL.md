# Learner Authenticity Study Protocol (LAS)

**Program:** Mission 22 CVHAP · **Metric:** Learner Authenticity Score (LAS) v1.0.0

## 1. Objective

Measure whether medical students, residents, psychologists, GPs, and counselors
experience VPsych conversations as immersive, educationally useful, and
supportive of diagnostic/interview confidence.

## 2. Design

- **Type:** Prospective multi-track learner evaluation after supervised sessions
- **Session:** One 15–25 minute interview (voice or text) with PME patient
- **Tracks:** Medical student · Psychiatry resident · Psychologist · GP · Counselor
- **Minimum n:** 20 completed LAS forms (stratify ≥4 per major track when possible)

## 3. Measures (1–5 Likert)

| Item | Construct |
|---|---|
| Immersion | Felt like talking with a person |
| Learning value | Learned clinically useful skills |
| Confidence after | Confidence managing similar presentation |
| Diagnostic reasoning | Helped practice differential thinking |
| Interview confidence | Helped practice interviewing |
| Perceived realism | Patient felt authentic |
| Educational usefulness | Would recommend for training |

Implementation: `src/lib/validation/las.ts`  
**Success threshold:** LAS overall ≥ 70 (n≥20).

## 4. Procedure

1. Brief orientation (simulator, not a real patient; safety resources)  
2. Complete session under instructor/self-paced protocol  
3. Immediate LAS form (no diagnosis reveal until after ratings)  
4. Optional structured debrief + reflection prompt  

## 5. Analysis

- LAS overall + subscores by track  
- Correlation with session duration / turn count (exploratory)  
- Qualitative themes from free text (immersion breakers)  

## 6. API

- `POST /api/admin/validation` `{ "action": "template_las" | "submit_las", ... }`
