//! ASIS Project Registry — Soroban key/value storage for structural analysis results.
#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Env, String, Vec};

// ---------------------------------------------------------------------------
// Data stored on-chain (matches backend JSON; score is fixed-point: ×10_000)
// Example: 0.89 → 8900
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
pub struct ProjectData {
    pub project_id: String,
    pub cost: u128,
    pub materials: Vec<String>,
    pub score: u128,
    pub explanation: String,
}

#[contract]
pub struct ProjectRegistry;

#[contractimpl]
impl ProjectRegistry {
    /// Store `data` under `id` (e.g. "FP101"). Overwrites if key exists.
    pub fn store_project(env: Env, id: String, data: ProjectData) {
        let storage = env.storage().persistent();
        storage.set(&id, &data);
    }

    /// Read project by `id`. Returns None if missing.
    pub fn get_project(env: Env, id: String) -> Option<ProjectData> {
        env.storage().persistent().get(&id)
    }
}
