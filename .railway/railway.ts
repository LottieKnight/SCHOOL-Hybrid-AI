import { defineRailway, github, project, service } from "railway/iac";

export default defineRailway(() => {
  const web = service("web", {
    source: github("LottieKnight/SCHOOL-Academic-Platform"),
    build: "npm run build",
    start: "npm run start -w apps/web",
  });

  return project("SCHOOL-Academic-Platform", {
    resources: [web],
  });
});
