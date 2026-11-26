import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SCHOOL — Student Platform",
    short_name: "SCHOOL",
    description:
      "Past papers, AI coaching, module rooms, and a study planner for South African students. Free to join.",
    start_url: "/",
    display: "standalone",
    background_color: "#081120",
    theme_color: "#081120",
    orientation: "any",
    lang: "en-ZA",
    dir: "ltr",
    categories: ["education"],
    icons: [
      {
        src: "/images/pwa/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/pwa/maskable-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Hybrid tutor",
        short_name: "Tutor",
        description: "Hints that can run on this phone without mobile data",
        url: "/tutor",
      },
      {
        name: "Community",
        short_name: "Community",
        description: "Ask questions and browse your module rooms",
        url: "/community",
      },
      {
        name: "Daily Quiz",
        short_name: "Quiz",
        description: "Take today's quiz and keep your streak",
        url: "/daily-quiz",
      },
      {
        name: "Past Papers",
        short_name: "Papers",
        description: "Browse past exam papers by subject and grade",
        url: "/past-papers",
      },
    ],
  };
}
