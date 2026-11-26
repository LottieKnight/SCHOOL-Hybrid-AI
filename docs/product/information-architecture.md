# SCHOOL Information Architecture

## Primary Product Model

The repo already contains multiple valid surfaces. The IA should now clarify their jobs.

## Top-Level Student Navigation

### 1. Command Center

Route: `/dashboard`

Purpose:

- today view
- next-best action
- due items
- mastery/review cues
- assessment entry
- planner and tutor escalation

### 2. Study

Routes:

- `/learn`
- `/assistant`
- `/profile/learning`

Purpose:

- curriculum learning
- AI coaching
- memory and progress review

### 3. Practice

Routes:

- `/classes/[classId]/past-papers`
- `/daily-quiz`

Purpose:

- exam prep
- question practice
- weakness detection

This area should be framed as the main proof-of-progress engine.

### 4. Plan

Routes:

- `/planner`

Purpose:

- deadlines
- exam timelines
- revision scheduling
- academic calendar coordination

### 5. Community and Support

Routes:

- `/community`
- `/messages`
- `/tutors`

Purpose:

- academic discussion
- peer help
- tutor escalation

### 6. Resources

Routes:

- `/textbooks`
- `/bookstore`
- `/store/equipment`

Purpose:

- resource discovery
- institution-aware recommendations
- academic shopping support

## Command Center Page Hierarchy

Order the dashboard by urgency and execution value:

1. Hero decision area
2. Key academic stats
3. Command center priorities
4. Learner memory and review cues
5. Assessment-first actions
6. Planner / upcoming
7. Support escalation and resources
8. Activity feed

## Future Navigation Implications

- Keep past papers one tap away from the dashboard and sidebar.
- Do not bury planner behind secondary utility navigation.
- Community should remain tied to academic context, not generic feed behavior.
- Tutor marketplace should appear as escalation from diagnosed need.

## Naming Direction

- Prefer "Command Center" over generic "Dashboard" in UI copy when appropriate.
- Prefer "AI Study Coach" or "AI Tutor" over generic "assistant" in student-facing copy.
- Prefer "Practice" or "Past Papers" over vague "resources" when the user is actually preparing for exams.
