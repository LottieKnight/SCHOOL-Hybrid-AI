import { z } from "zod";
export declare const UniversityModuleSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    semester: z.ZodNullable<z.ZodNumber>;
    yearOfStudy: z.ZodNumber;
    credits: z.ZodNullable<z.ZodNumber>;
    isCore: z.ZodNullable<z.ZodBoolean>;
    durationType: z.ZodNullable<z.ZodEnum<["semester", "year"]>>;
    durationLabel: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    semester: number | null;
    yearOfStudy: number;
    credits: number | null;
    isCore: boolean | null;
    durationType: "semester" | "year" | null;
    durationLabel: string | null;
}, {
    code: string;
    name: string;
    semester: number | null;
    yearOfStudy: number;
    credits: number | null;
    isCore: boolean | null;
    durationType: "semester" | "year" | null;
    durationLabel: string | null;
}>;
export declare const UniversityModulePlanSchema: z.ZodArray<z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    semester: z.ZodNullable<z.ZodNumber>;
    yearOfStudy: z.ZodNumber;
    credits: z.ZodNullable<z.ZodNumber>;
    isCore: z.ZodNullable<z.ZodBoolean>;
    durationType: z.ZodNullable<z.ZodEnum<["semester", "year"]>>;
    durationLabel: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    semester: number | null;
    yearOfStudy: number;
    credits: number | null;
    isCore: boolean | null;
    durationType: "semester" | "year" | null;
    durationLabel: string | null;
}, {
    code: string;
    name: string;
    semester: number | null;
    yearOfStudy: number;
    credits: number | null;
    isCore: boolean | null;
    durationType: "semester" | "year" | null;
    durationLabel: string | null;
}>, "many">;
export type UniversityModule = z.infer<typeof UniversityModuleSchema>;
export type UniversityModulePlan = z.infer<typeof UniversityModulePlanSchema>;
export declare function slugifyInstitution(name: string): string;
export declare function buildUniversityModuleHref(moduleCode: string): string;
//# sourceMappingURL=university.d.ts.map