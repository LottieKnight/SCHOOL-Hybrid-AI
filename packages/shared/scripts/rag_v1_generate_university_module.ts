import { existsSync } from "node:fs";
import {
  generateUniversityModuleLesson,
  getUniversityLessonOutputPaths,
  writeUniversityLessonFiles,
  type UniversityGenerateInput,
} from "../src/rag_v1/university-generator.js";

type ArgMap = Record<string, string>;

function parseArgs(argv: string[]) {
  const args: ArgMap = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;
    const [key, inlineValue] = raw.slice(2).split("=");
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = "true";
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const institution = args.institution;
  const faculty = args.faculty;
  const course = args.course;
  const yearOfStudy = args.year ? Number(args.year) : null;
  const moduleCode = args.module || args.moduleCode;
  const moduleName = args.name;
  const topic = args.topic;
  const force = args.force === "true";

  if (!institution || !faculty || !course || yearOfStudy === null || !moduleCode) {
    console.error(
      "Usage: tsx scripts/rag_v1_generate_university_module.ts \\\n" +
        "  --institution \"University of Johannesburg\" \\\n" +
        "  --faculty \"College of Business and Economics\" \\\n" +
        "  --course \"Bachelor of Commerce\" \\\n" +
        "  --year 2 \\\n" +
        "  --module ECON211 \\\n" +
        "  [--name \"Macroeconomics\"] \\\n" +
        "  [--topic \"IS-LM model\"] \\\n" +
        "  [--force true]"
    );
    process.exit(1);
  }

  const input: UniversityGenerateInput = {
    institution,
    faculty,
    course,
    yearOfStudy,
    moduleCode,
    moduleName,
    topic,
    force,
  };

  const paths = getUniversityLessonOutputPaths(input);
  if (!force && existsSync(paths.lessonPath)) {
    console.log(`Lesson already exists at ${paths.lessonPath}. Use --force true to regenerate.`);
    return;
  }

  console.log(`Generating lesson for ${moduleCode} (${institution})…`);
  const result = await generateUniversityModuleLesson(input);
  const written = writeUniversityLessonFiles({ input, result });

  console.log(`Generated lesson at ${written.lessonPath}`);
  console.log(`Report saved at ${written.generationPath}`);
  console.log(`Model used: ${result.usedModel}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
