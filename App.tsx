import { useCallback, useState, useRef } from "react";
import { getAddress, requestAccess } from "@stellar/freighter-api";
import { getProjectSimulated, storeProject } from "./stellar";
import { Viewer3D } from "./Viewer3D";
import { ResultsCard } from "./ResultsCard";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

interface AnalysisData {
  project_id: string;
  cost: number;
  materials: string[];
  score: number;
  explanation: string;
  preview_3d_base64?: string;
  height_map_data?: number[][];
}

export default function App() {
  const [contractId, setContractId] = useState(
    () => localStorage.getItem("asis_contract_id") || ""
  );
  const [storageKey, setStorageKey] = useState("FP101");
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [log, setLog] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyProcessPayload = useCallback((data: Record<string, unknown>) => {
    const analysis: AnalysisData = {
      project_id: String(data.project_id || ""),
      cost: Number(data.cost || 0),
      materials: (data.materials as string[]) || [],
      score: Number(data.score || 0),
      explanation: String(data.explanation || ""),
      preview_3d_base64: (data.preview_3d_base64 as string) || undefined,
      height_map_data: (data.height_map_data as number[][]) || undefined,
    };
    setAnalysisData(analysis);
    setStorageKey(analysis.project_id);
  }, []);

  const appendLog = useCallback((msg: string) => {
    setLog((prev) => `${prev}\n${msg}`.trim());
  }, []);

  const loadDemoFromBackend = useCallback(async () => {
    setBusy(true);
    setUploadedFileName("Sample Floor Plan (Demo)");
    appendLog(`🎬 Loading sample visualization...`);
    try {
      const r = await fetch(`${API_BASE}/process/demo`);
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as Record<string, unknown>;
      applyProcessPayload(data);
      setStorageKey(String(data.project_id ?? ""));
      appendLog(`✅ Sample loaded successfully!`);
    } catch (e) {
      appendLog(`❌ Demo error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [appendLog, applyProcessPayload]);

  const runProcessUpload = useCallback(
    async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      setUploadedFileName(file.name);
      setBusy(true);
      appendLog(`📤 Processing "${file.name}"...`);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const r = await fetch(`${API_BASE}/process`, { method: "POST", body: fd });
        if (!r.ok) throw new Error(await r.text());
        const data = (await r.json()) as Record<string, unknown>;
        applyProcessPayload(data);
        setStorageKey(String(data.project_id ?? ""));
        appendLog(`✅ Successfully generated 3D visualization! — project_id=${String(data.project_id)}`);
      } catch (e) {
        appendLog(`❌ Process error: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusy(false);
      }
    },
    [appendLog, applyProcessPayload]
  );

  const persistContractId = (id: string) => {
    setContractId(id);
    localStorage.setItem("asis_contract_id", id);
  };

  const onStore = async () => {
    if (!contractId.trim()) {
      appendLog("Set Contract ID first (deploy the contract, then paste C… address).");
      return;
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(backendJson || "{}") as Record<string, unknown>;
    } catch {
      appendLog("Backend JSON invalid — click “Load demo from backend” or paste valid JSON.");
      return;
    }
    setBusy(true);
    try {
      await requestAccess();
      const send = await storeProject({
        contractId: contractId.trim(),
        storageKey: storageKey.trim(),
        backendResult: {
          project_id: String(payload.project_id),
          cost: Number(payload.cost),
          materials: payload.materials as string[],
          score: Number(payload.score),
          explanation: String(payload.explanation),
        },
      });
      appendLog(
        `sendTransaction: status=${send.status} hash=${send.hash ?? "(n/a)"}`
      );
    } catch (e) {
      appendLog(`Store error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const onFetch = async () => {
    if (!contractId.trim()) {
      appendLog("⚠️ Contract ID required.");
      return;
    }
    setBusy(true);
    appendLog(`🔄 Fetching from blockchain...`);
    try {
      await requestAccess();
      const addrRes = await getAddress();
      if (addrRes.error) throw new Error(addrRes.error.message);
      const data = await getProjectSimulated({
        contractId: contractId.trim(),
        storageKey: storageKey.trim(),
        readerAddress: addrRes.address,
      });
      appendLog(`✅ Retrieved: ${JSON.stringify(data, null, 2)}`);
    } catch (e) {
      appendLog(`❌ Fetch error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main>
      <div className="header">
        <h1>🏗️ 3D Floor Plan Visualizer</h1>
        <p className="subtitle">Instant interactive 3D visualization • Drag to rotate • Scroll to zoom</p>
      </div>

      {/* STEP 1: UPLOAD */}
      <div className="panel step-panel">
        <div className="step-number">STEP 1</div>
        <h2>📤 Generate 3D Visualization</h2>
        <p className="helper-text">Try the demo first, or upload your floor plan image</p>
        
        <div className="button-group">
          <button 
            type="button" 
            disabled={busy} 
            onClick={loadDemoFromBackend}
            className="btn-primary"
          >
            🎬 Load Sample
          </button>
          <label className="btn-secondary file-label">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={runProcessUpload}
              disabled={busy}
            />
            📤 Upload Floor Plan
          </label>
        </div>
        
        {uploadedFileName && (
          <div className="file-info">
            ✓ {uploadedFileName}
          </div>
        )}
      </div>

      {/* 3D INTERACTIVE VIEW */}
      {analysisData?.height_map_data && (
        <div className="panel preview-panel">
          <h2>✨ Interactive 3D Visualization</h2>
          <Viewer3D heightMapData={analysisData.height_map_data} projectId={analysisData.project_id} />
        </div>
      )}

      {/* STEP 2: ANALYSIS RESULTS */}
      {analysisData && (
        <div className="panel step-panel">
          <div className="step-number">STEP 2</div>
          <h2>📊 Analysis Results</h2>
          <p className="helper-text">Your floor plan analysis in simple, easy-to-understand format</p>
          
          <ResultsCard data={analysisData} />
        </div>
      )}

      {/* STEP 3: BLOCKCHAIN (Optional) */}
      <div className="panel step-panel">
        <div className="step-number">STEP 3</div>
        <h2>🔗 Blockchain Storage (Optional)</h2>
        <p className="helper-text">Store your analysis permanently on Stellar blockchain for proof</p>

        <div className="form-group">
          <label>Contract ID</label>
          <input
            type="text"
            placeholder="Paste your C... contract address here"
            value={contractId}
            onChange={(e) => persistContractId(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>Storage Key</label>
          <input
            type="text"
            value={storageKey}
            onChange={(e) => setStorageKey(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="button-group">
          <button type="button" disabled={busy} onClick={onStore} className="btn-primary">
            💾 Store on Chain
          </button>
          <button type="button" disabled={busy} onClick={onFetch} className="btn-secondary">
            🔍 Retrieve
          </button>
        </div>
      </div>

      {/* API STATUS */}
      <div className="panel status-panel">
        <h3>🌐 API Status</h3>
        <div className="status-info">
          <span>Backend: </span>
          <code>{API_BASE}</code>
        </div>
        <div className="status-info">
          <span>Status: </span>
          <span className="status-badge">{busy ? "Processing..." : "Ready"}</span>
        </div>
      </div>

      {/* ACTIVITY LOG */}
      <div className="panel log-panel">
        <h2>📋 Activity Log</h2>
        <div className="log-container">
          <pre className="log-content">{log || "Waiting for activity..."}</pre>
        </div>
        {log && (
          <button 
            type="button" 
            onClick={() => setLog("")}
            className="btn-tertiary"
          >
            Clear Log
          </button>
        )}
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <p>Load a sample to see it in action • Questions? Check QUICK_START.md</p>
      </footer>
    </main>
  );
}
