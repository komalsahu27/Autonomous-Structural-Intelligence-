/**
 * JSON shape from FastAPI POST /process or GET /process/demo.
 */
export interface BackendAnalysisResult {
  project_id: string;
  cost: number;
  materials: string[];
  score: number;
  explanation: string;
}

/**
 * On-chain ProjectData (matches contracts/project-registry ProjectData).
 * u128 fields are bigint in JS bindings.
 */
export interface ProjectData {
  project_id: string;
  cost: bigint;
  materials: string[];
  /** Fixed-point: human score × 10_000 (e.g. 0.89 → 8900n). */
  score: bigint;
  explanation: string;
}

/** Normalized row for UI after reading from chain. */
export interface DisplayProjectRow {
  project_id: string;
  cost: number;
  materials: string[];
  score: number;
  explanation: string;
}
