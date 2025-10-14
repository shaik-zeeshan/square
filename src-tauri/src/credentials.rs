use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct UserCredential {
    pub password: String,
    pub saved_at: i64,
}

// Note: Credential operations are handled by the frontend JavaScript API
// The Rust backend only provides the Stronghold plugin initialization
