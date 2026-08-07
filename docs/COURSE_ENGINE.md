# Course Engine — Stage 10

**Code:** `src/lib/enterprise/course-engine.ts`  
**Tables:** `enterprise_courses`, `enterprise_course_modules`, `enterprise_course_lessons`, `enterprise_clinical_rotations`, `enterprise_learning_paths`, `enterprise_graduation_requirements`

## Capabilities

- Courses · Modules · Lessons (didactic / simulation / OSCE / rotation / reflection / assessment)
- Clinical rotations with supervisor user ids
- Assignments remain Mission 18 `learning_assignments` (composed, not forked)
- Case libraries referenced via `simulation_template_slug` (Case Engine owns templates)
- Competency mapping via Stage 7 competency id strings
- Learning paths + graduation requirements

## Rules

1. Cross-tenant lesson attach throws.  
2. Publish bumps version; retired courses cannot republish.  
3. Graduation evaluation is conservative (sessions + formative EMA + competencies + cert kinds).  
4. Never writes patient clinical state.
