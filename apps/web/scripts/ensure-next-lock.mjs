import { mkdir, writeFile } from "node:fs/promises";

// Vercel's packager expects the Next build lock file to exist after build.
await mkdir(".next", { recursive: true });
await writeFile(".next/lock", "");
