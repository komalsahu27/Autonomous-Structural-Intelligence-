import type { Client } from "@stellar/stellar-sdk/contract";
import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import type { Option } from "@stellar/stellar-sdk/contract";
import type { ProjectData } from "./types";

/**
 * Typed view of the Soroban contract client. Method names and args match the Rust contract;
 * encoding/decoding uses the embedded contract spec (same pipeline as `stellar contract bindings typescript`).
 */
export interface ProjectRegistryClient extends Client {
  store_project(args: {
    id: string;
    data: ProjectData;
  }): Promise<AssembledTransaction<void>>;
  get_project(args: { id: string }): Promise<
    AssembledTransaction<Option<ProjectData>>
  >;
}
