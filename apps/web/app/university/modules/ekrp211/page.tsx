import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "EKRP211 Introduction to Risk Management | SCHOOL",
  description:
    "EKRP211 now lives on the canonical learn surface at /learn/ekrp211.",
};

export default function Ekrp211ModulePage() {
  redirect("/learn/ekrp211");
}
