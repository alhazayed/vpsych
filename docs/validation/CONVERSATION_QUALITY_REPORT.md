# Conversation Quality Report

**Program:** Mission 22 Workstream E  
**Engine:** `src/lib/validation/conversation-quality.ts`

## 1. Scope

Systematic automated flags for AI-like or educationally harmful dialogue.
**English and Arabic are evaluated independently** (never translated scoring).

## 2. Flag categories

| Category | Examples |
|---|---|
| AI wording | “As an AI…”, assistant-register |
| Formal language | Essay connectives; stiff MSA markers in AR |
| Textbook | Self-stated DSM criteria / jargon dumps |
| Verbosity | >70 words / turn |
| Repetition | Repeated sentence openings |
| Literal translation | AR session without Arabic script |

## 3. Scoring

Start at 88; subtract by severity. Combined bilingual score = mean(EN, AR).

## 4. Current dry-run posture

- Natural PME-style EN samples pass when free of AI tells  
- Toxic legacy samples fail hard on AI wording / textbook  
- AR samples require Arabic script + dialect cues  

## 5. Required human review

Automated QC is necessary but insufficient. Before expert beta:

1. Native EN clinician review of 10 packs  
2. Native Jordanian Arabic clinician review of 10 packs  
3. Log high-severity findings into remediation tickets with before/after PAS  

## 6. Remediation ownership

PME expression hard-constraints + HCFI natural_language dimension + prompt v4
Module 1B. Do not add unrelated features — fix verified dialogue defects only.
