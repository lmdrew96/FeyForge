import { anthropic } from "@ai-sdk/anthropic"

// Undated alias — always resolves to the latest Haiku 4.5 snapshot, so newer
// Haiku releases are picked up without a code change. Pin a dated id (e.g.
// "claude-haiku-4-5-20251001") only if a specific snapshot is ever required.
export const AI_MODEL = anthropic("claude-haiku-4-5")
