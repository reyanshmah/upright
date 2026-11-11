/**
 * The real model call. Server-only: the key comes from ANTHROPIC_API_KEY in
 * the server environment and never reaches the client bundle.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { CallModel } from "./generate";
import { ReportOutputSchema } from "./schema";

/** MASTER.md names Claude Sonnet 5.5. It rejects temperature settings, so none is sent. */
export const REPORT_MODEL = "claude-sonnet-5-5";

/** null when no key is configured: the route then uses the template. */
export function anthropicCaller(): CallModel | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  // No SDK retries: the pipeline regenerates once itself, inside one 15 s budget.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });
  return async ({ system, user, timeoutMs }) => {
    const res = await client.beta.messages.parse(
      {
        model: REPORT_MODEL,
        max_tokens: 8000,
        // Server-side refusal fallback: a declined request is re-run on a fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: betaZodOutputFormat(ReportOutputSchema) },
        system,
        messages: [{ role: "user", content: user }],
      },
      { timeout: timeoutMs },
    );
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
    return res.parsed_output ?? null;
  };
}
