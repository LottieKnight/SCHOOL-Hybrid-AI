import "server-only";

import { inferRelevantGeneratedModules, loadGeneratedModuleContent } from "@/lib/server/languageContent";

function uniqueLines(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function buildGroundingForModule(moduleCode: string, material: string) {
  const content = loadGeneratedModuleContent(moduleCode);
  if (!content) return "";

  const loweredMaterial = typeof material === "string" ? material.toLowerCase() : "";

  const matchedTopics = uniqueLines(
    (content.keyTopics ?? []).filter(
      (topic) =>
        typeof topic === "string" &&
        loweredMaterial.includes(topic.toLowerCase().slice(0, Math.min(topic.length, 24)))
    )
  ).slice(0, 5);

  const matchedErrors = uniqueLines(
    (content.commonExamErrors ?? []).filter((item) => {
      if (typeof item !== "string") return false;
      const fragment = item.toLowerCase().split(/[^a-z0-9]+/).filter((part) => part.length > 5)[0] ?? "";
      return fragment && loweredMaterial.includes(fragment);
    })
  ).slice(0, 3);

  const matchedInsights = (content.chapterInsights ?? [])
    .filter((insight) => {
      const candidates = [insight.title, ...(insight.definitions ?? []), ...(insight.formulas ?? []), ...(insight.outcomes ?? [])]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.toLowerCase());
      return candidates.some((candidate) => candidate.length > 8 && loweredMaterial.includes(candidate.slice(0, Math.min(candidate.length, 24))));
    })
    .slice(0, 2);

  const lines: string[] = [];
  lines.push(`Grounded module context: ${content.moduleCode ?? moduleCode} — ${content.moduleName ?? "Module"}.`);

  if ((content.keyTopics ?? []).length > 0) {
    lines.push(`Core module topics include: ${(content.keyTopics ?? []).slice(0, 8).join("; ")}.`);
  }

  if (matchedTopics.length > 0) {
    lines.push(`Likely matched topics from the student's material: ${matchedTopics.join("; ")}.`);
  }

  for (const insight of matchedInsights) {
    if (insight.title) {
      lines.push(`Relevant section: ${insight.chapter ?? "Chapter"} — ${insight.title}.`);
    }
    if ((insight.definitions ?? []).length > 0) {
      lines.push(`Useful definitions: ${(insight.definitions ?? []).slice(0, 2).join(" ")}`);
    }
    if ((insight.formulas ?? []).length > 0) {
      lines.push(`Relevant formulas: ${(insight.formulas ?? []).slice(0, 2).join(" ")}`);
    }
    if (insight.saContext) {
      lines.push(`South African context: ${insight.saContext}`);
    }
  }

  if (matchedErrors.length > 0) {
    lines.push(`Avoid these common exam errors if relevant: ${matchedErrors.join(" ")}`);
  }

  return lines.join("\n");
}

export function buildAssistantGroundingBlock(input: {
  moduleCode?: string | null;
  material: string;
}) {
  const preferredModuleCode = typeof input.moduleCode === "string" ? input.moduleCode.trim() : "";
  const moduleMatches = inferRelevantGeneratedModules(
    typeof input.material === "string"
      ? {
          query: input.material,
          preferredModuleCode,
          limit: 2,
        }
      : {
          query: "",
          preferredModuleCode,
          limit: 2,
        }
  );

  const blocks = moduleMatches
    .map((match) => buildGroundingForModule(match.moduleCode, input.material))
    .filter(Boolean)
    .slice(0, 2);

  if (blocks.length === 0) return "";

  return [
    ...blocks,
    "Use this grounding only when it matches the student's material. If the material conflicts, prioritize the student's text and clearly say when you are inferring from module context.",
  ].join("\n\n");
}
