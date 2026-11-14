"use client";

import { LegalPage } from "@/components/LegalPage";
import { privacyPolicy } from "@/lib/legal";

export default function Privacy() {
  return <LegalPage doc={privacyPolicy} />;
}
