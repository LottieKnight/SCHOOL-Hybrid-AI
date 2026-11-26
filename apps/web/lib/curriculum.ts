import { CourseOutline, loadCourseOutline } from "@saedu/shared";

export type SubjectNode = {
  name: string;
  terms?: Record<string, any>;
  children?: Record<string, SubjectNode>;
};

export function getCourseOutline(): CourseOutline {
  return loadCourseOutline();
}

export function getPhases() {
  const outline = getCourseOutline();
  return Object.entries(outline.phases).map(([key, value]) => ({
    key,
    name: value.name,
  }));
}

export function getGrades(phaseKey: string) {
  const outline = getCourseOutline();
  const phase = outline.phases[phaseKey];
  if (!phase) return [];
  return Object.entries(phase.grades).map(([key, value]) => ({
    key,
    name: value.name,
  }));
}

export function getGroups(phaseKey: string, gradeKey: string) {
  const outline = getCourseOutline();
  const grade = outline.phases[phaseKey]?.grades[gradeKey];
  if (!grade) return [];
  return Object.entries(grade.groups).map(([key, value]) => ({
    key,
    name: value.name,
    subjects: value.subjects,
  }));
}

export function getGroup(phaseKey: string, gradeKey: string, groupKey: string) {
  const outline = getCourseOutline();
  return outline.phases[phaseKey]?.grades[gradeKey]?.groups[groupKey];
}

export function getSubject(
  phaseKey: string,
  gradeKey: string,
  groupKey: string,
  subjectKey: string
): SubjectNode | undefined {
  const group = getGroup(phaseKey, gradeKey, groupKey);
  return group?.subjects?.[subjectKey];
}

export function getChildSubject(
  phaseKey: string,
  gradeKey: string,
  groupKey: string,
  subjectKey: string,
  childKey: string
) {
  const subject = getSubject(phaseKey, gradeKey, groupKey, subjectKey);
  return subject?.children?.[childKey];
}
