import type { BackendAnalysisResult, ProjectData } from "./types";

const SCORE_SCALE = 10_000n;

/**
 * Convert API JSON → contract struct. Encoding is handled by the SDK Spec (same as CLI bindings).
 */
export function backendResultToProjectData(
  result: BackendAnalysisResult
): ProjectData {
  return {
    project_id: String(result.project_id),
    cost: BigInt(Math.trunc(Number(result.cost))),
    materials: result.materials.map((m) => String(m)),
    score: BigInt(Math.round(Number(result.score) * Number(SCORE_SCALE))),
    explanation: String(result.explanation),
  };
}
