import type { Metadata } from "next";
import { StudioHome } from "@/features/chronicles/components/studio-home";

export const metadata: Metadata = { title: "Chronicles Studio" };

export default function StudioPage() {
  return <StudioHome />;
}
