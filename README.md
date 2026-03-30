# Autonomous Structural Intelligence System (ASIS)

Hackathon layout: **Python** analysis API → **React** UI → **Stellar Soroban** contract for tamper-evident storage of analysis records.

## Project structure

```
project/
├── contracts/project-registry/   # Soroban smart contract (Rust)
│   ├── Cargo.toml
│   └── src/lib.rs
├── backend/                      # FastAPI + OpenCV stub
│   ├── main.py
│   └── requirements.txt
├── frontend/                     # Vite + React + TypeScript + Stellar SDK + Freighter
│   ├── package.json
│   ├── vite.config.js
│   ├── tsconfig.json
│   └── src/
│       ├── contracts/            # `types.ts`, `project_registry.ts`, typed `Client` interface
│       ├── stellar.ts            # `Client.from` + Freighter (same spec as CLI bindings)
│       └── App.tsx
└── README.md
```

## 1. Smart contract (Soroban)

- **Data:** `ProjectData { project_id, cost, materials, score, explanation }`
- **Keys:** Soroban `String` (e.g. `"FP101"`) → persistent storage.
- **Score on-chain:** integer `score × 10_000` (e.g. `0.89` → `8900`) to avoid floats in the VM.

Functions:

- `store_project(id: String, data: ProjectData)`
- `get_project(id: String) -> Option<ProjectData>`

## 2. Deployment steps (Stellar CLI)

Install **Rust** (rustup) and the **wasm** target, then install the **Stellar CLI** (current official tool; it includes `stellar contract …` for Soroban — older tutorials may say “Soroban CLI” only):

```bash
# Rust (https://rustup.rs/) — then:
rustup target add wasm32-unknown-unknown

# Stellar CLI (see https://developers.stellar.org/docs/tools/developer-tools )
cargo install --locked stellar-cli --features opt
```

Configure Testnet identity and fund it (Friendbot / Lab — use official Stellar Testnet docs):

```bash
stellar keys generate --global alice
stellar keys fund alice --network testnet
```

Build and deploy from the contract crate:

```bash
cd contracts/project-registry

# Build WASM (output path is printed; usually target/wasm32-unknown-unknown/release/project_registry.wasm)
stellar contract build

# Deploy — inside the crate dir you can omit --wasm and the CLI will build for you:
stellar contract deploy --source alice --network testnet

# Or point at the built file explicitly:
# stellar contract deploy --wasm target/wasm32-unknown-unknown/release/project_registry.wasm --source alice --network testnet
```

### How to get the Contract ID

- The CLI prints the new contract’s **contract ID** (a `C…` **strkey**) when deployment succeeds.
- You can also run `stellar contract id --help` patterns or inspect the transaction in a Stellar explorer.
- Paste that `C…` value into the frontend field **Contract ID** (also stored in `localStorage` as `asis_contract_id`).

## 3. Backend (FastAPI)

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- `GET /process/demo` — fixed JSON sample (matches your hackathon example) plus `preview_3d_base64` (PNG).
- `POST /process` — form field `file` = floor plan image; returns analysis JSON and **`preview_3d_base64`**: a base64 PNG of a **3D surface** (matplotlib) built from edges + room depth, with an OpenCV depth-map fallback if matplotlib is not installed.
- `GET /health` — liveness check.

## 4. Frontend (React + TypeScript)

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE` if the API is not at `http://127.0.0.1:8000`.

Install the **Freighter** browser wallet, switch to **Testnet**, fund the same account you use for deployment (or fund via Friendbot).

### Typed contract calls (no hand-rolled `nativeToScVal`)

`frontend/src/stellar.ts` uses **`Client.from`** from `@stellar/stellar-sdk/contract`. It downloads the contract’s WASM **from your deployed contract id** over RPC and parses the embedded **contract spec** — the same metadata the CLI uses when you run:

```bash
cd contracts/project-registry
stellar contract build
cd ../../frontend
npm run gen:bindings
```

`npm run gen:bindings` runs `stellar contract bindings typescript` and writes a standalone package under `src/contract-bindings-generated/` (optional). The app does **not** require that folder for builds: runtime typing is in `src/contracts/` + `ProjectRegistryClient` (see `project_registry_client.ts`).

If the WASM path differs after `stellar contract build`, adjust the `--wasm` path in `frontend/package.json` → `scripts.gen:bindings`.

## 5. Integration flow

1. **Frontend** calls `GET /process/demo` or `POST /process` → receives JSON.
2. User clicks **Store on Blockchain** → **Freighter** signs `store_project` on Testnet.
3. User clicks **Fetch from Blockchain** → app runs **`get_project` via RPC simulation** (read-only, no second fee) and shows decoded JSON.

Backend does not need a Stellar secret: the **browser wallet** signs writes; the app only needs the **contract ID** and **RPC URL** (hard-coded Testnet RPC in `frontend/src/stellar.ts`).

## 6. Demo flow for judges

1. **Upload** — Select a floor plan image → `POST /process` shows structured analysis JSON.
2. **Process** — Explain materials, cost, score, and narrative (your OpenCV / ML story).
3. **Store** — Paste deployed **Contract ID**, click **Store on Blockchain**, approve in Freighter → note **transaction hash** from the log.
4. **Fetch** — Click **Fetch from Blockchain** → show the same record returned from the contract (prove persistence).
5. **Verify** — Open the tx or contract in a Stellar block explorer (Testnet) and point to the on-chain proof.

Keep Testnet XLM on your demo account for `store_project` (writes cost a small fee; `get_project` in this template uses **simulation only** for reads).
