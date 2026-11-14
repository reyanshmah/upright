"use client";

import { LegalPage } from "@/components/LegalPage";
import { termsOfService } from "@/lib/legal";

export default function Terms() {
  return <LegalPage doc={termsOfService} />;
}
