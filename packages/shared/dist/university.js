import { z } from "zod";
export const UniversityModuleSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    semester: z.number().int().min(1).max(2).nullable(),
    yearOfStudy: z.number().int().min(1),
    credits: z.number().nullable(),
    isCore: z.boolean().nullable(),
    durationType: z.enum(["semester", "year"]).nullable(),
    durationLabel: z.string().nullable(),
});
export const UniversityModulePlanSchema = z.array(UniversityModuleSchema);
export function slugifyInstitution(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}
export function buildUniversityModuleHref(moduleCode) {
    return `/university/modules/${moduleCode.toLowerCase()}`;
}
