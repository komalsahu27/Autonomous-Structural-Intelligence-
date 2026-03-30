/**
 * Soroban integration using @stellar/stellar-sdk/contract Client — loads the same WASM spec
 * RPC fetches from your deployed contract id (equivalent to CLI-generated bindings).
 */

import { Client } from "@stellar/stellar-sdk/contract";
import type { SignTransaction } from "@stellar/stellar-sdk/contract";
import { Networks } from "@stellar/stellar-sdk";
import { requestAccess, signTransaction as freighterSign } from "@stellar/freighter-api";
import { backendResultToProjectData } from "./contracts/project_registry";
import type { ProjectRegistryClient } from "./contracts/project_registry_client";
import type {
  BackendAnalysisResult,
  DisplayProjectRow,
  ProjectData,
} from "./contracts/types";

export const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org:443";

function freighterSignTransactionAdapter(): SignTransaction {
  return async (xdr, opts) => {
    const r = await freighterSign(xdr, {
      networkPassphrase: opts?.networkPassphrase ?? Networks.TESTNET,
      address: opts?.address,
    });
    if (r.error) {
      throw new Error(r.error.message ?? String(r.error));
    }
    return {
      signedTxXdr: r.signedTxXdr,
      signerAddress: r.signerAddress,
    };
  };
}

function assertFreighterOk<T extends { error?: { message?: string } }>(res: T): void {
  if (res?.error) {
    throw new Error(res.error.message ?? String(res.error));
  }
}

/**
 * Load client + WASM spec from chain (no local wasm file needed).
 * `read` = simulation-only (no wallet signer on the client options).
 * `write` = attach Freighter-compatible `signTransaction` for `signAndSend`.
 */
export async function connectProjectRegistryClient(
  contractId: string,
  publicKey: string,
  mode: "read" | "write" = "write"
): Promise<ProjectRegistryClient> {
  const client = await Client.from({
    contractId,
    rpcUrl: SOROBAN_RPC_URL,
    networkPassphrase: Networks.TESTNET,
    allowHttp: false,
    publicKey,
    ...(mode === "write" ? { signTransaction: freighterSignTransactionAdapter() } : {}),
  });
  return client as ProjectRegistryClient;
}

export function normalizeProjectData(
  raw: unknown
): DisplayProjectRow | null {
  if (raw == null) return null;
  const data =
    raw && typeof raw === "object" && "Some" in raw
      ? (raw as { Some?: ProjectData }).Some
      : (raw as ProjectData | null);
  if (data == null || typeof data !== "object") return null;

  const cost = data.cost != null ? Number(data.cost) : NaN;
  const scoreRaw = data.score != null ? Number(data.score) : NaN;
  const score =
    typeof scoreRaw === "number" && !Number.isNaN(scoreRaw)
      ? scoreRaw / 10_000
      : 0;

  return {
    project_id: String(data.project_id),
    cost: Number.isNaN(cost) ? 0 : cost,
    materials: Array.isArray(data.materials) ? data.materials : [],
    score,
    explanation: String(data.explanation ?? ""),
  };
}

export async function storeProject(params: {
  contractId: string;
  storageKey: string;
  backendResult: BackendAnalysisResult;
}): Promise<{ status: string; hash?: string }> {
  const ra = await requestAccess();
  assertFreighterOk(ra);

  const client = await connectProjectRegistryClient(
    params.contractId,
    ra.address,
    "write"
  );

  const data = backendResultToProjectData(params.backendResult);
  const tx = await client.store_project({
    id: params.storageKey,
    data,
  });

  const sent = await tx.signAndSend();
  const resp = sent.sendTransactionResponse;
  return {
    status: resp?.status ?? "unknown",
    hash: resp?.hash,
  };
}

export async function getProjectSimulated(params: {
  contractId: string;
  storageKey: string;
  readerAddress: string;
}): Promise<DisplayProjectRow | null> {
  const client = await connectProjectRegistryClient(
    params.contractId,
    params.readerAddress,
    "read"
  );

  const tx = await client.get_project({ id: params.storageKey });
  const raw = tx.result;
  return normalizeProjectData(raw);
}
