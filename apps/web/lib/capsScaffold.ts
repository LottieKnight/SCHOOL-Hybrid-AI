import { loadCapsScaffold, type CapsScaffoldSubject } from "@saedu/shared";

export type ScaffoldSubjectNode = CapsScaffoldSubject;

export function getScaffoldPhases() {
  const scaffold = loadCapsScaffold();
  return Object.entries(scaffold.phases).map(([key, value]) => ({
    key,
    name: value.name,
  }));
}

export function getScaffoldGrades(phaseKey: string) {
  const scaffold = loadCapsScaffold();
  const phase = scaffold.phases[phaseKey];
  if (!phase) return [];
  return Object.entries(phase.grades).map(([key, value]) => ({
    key,
    name: value.name,
  }));
}

export function getScaffoldGroups(phaseKey: string, gradeKey: string) {
  const scaffold = loadCapsScaffold();
  const grade = scaffold.phases[phaseKey]?.grades[gradeKey];
  if (!grade) return [];
  return Object.entries(grade.groups).map(([key, value]) => ({
    key,
    name: value.name,
    subjects: value.subjects,
  }));
}

export function getScaffoldGroup(phaseKey: string, gradeKey: string, groupKey: string) {
  const scaffold = loadCapsScaffold();
  return scaffold.phases[phaseKey]?.grades[gradeKey]?.groups[groupKey];
}

export function getScaffoldSubject(
  phaseKey: string,
  gradeKey: string,
  groupKey: string,
  subjectKey: string
) {
  const group = getScaffoldGroup(phaseKey, gradeKey, groupKey);
  return group?.subjects?.[subjectKey];
}

export function getScaffoldChildSubject(
  phaseKey: string,
  gradeKey: string,
  groupKey: string,
  subjectKey: string,
  childKey: string
) {
  const subject = getScaffoldSubject(phaseKey, gradeKey, groupKey, subjectKey);
  return subject?.children?.[childKey];
}
