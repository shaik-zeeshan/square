use serde::{Deserialize, Serialize};
use serde_json::json;
use specta::Type;
use tauri::{AppHandle, Wry};
use tauri_plugin_store::StoreExt;

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GeneralSettings {
    pub volume: f64,
    pub playback_speed: f64,
    pub subtitle_language: Option<String>,
    pub audio_language: Option<String>,
    pub auto_play_next: bool,
    pub resume_playback: bool,
}

impl Default for GeneralSettings {
    fn default() -> Self {
        Self {
            volume: 1.0,
            playback_speed: 1.0,
            subtitle_language: Some("en".to_string()),
            audio_language: Some("en".to_string()),
            auto_play_next: true,
            resume_playback: true,
        }
    }
}

impl GeneralSettings {
    pub fn get(app: &AppHandle<Wry>) -> Result<Option<Self>, String> {
        match app.store("store").map(|s| s.get("general_settings")) {
            Ok(Some(store)) => match serde_json::from_value(store) {
                Ok(settings) => Ok(Some(settings)),
                Err(e) => Err(format!("Failed to deserialize general settings store: {e}")),
            },
            _ => Ok(None),
        }
    }

    pub fn update(app: &AppHandle, update: impl FnOnce(&mut Self)) -> Result<(), String> {
        let Ok(store) = app.store("store") else {
            return Err("Store not found".to_string());
        };

        let mut settings = Self::get(app)?.unwrap_or_default();
        update(&mut settings);
        store.set("general_settings", json!(settings));
        store.save().map_err(|e| e.to_string())
    }

    fn save(&self, app: &AppHandle) -> Result<(), String> {
        let Ok(store) = app.store("store") else {
            return Err("Store not found".to_string());
        };

        store.set("general_settings", json!(self));
        store.save().map_err(|e| e.to_string())
    }
}

pub fn init(app: &AppHandle) {
    println!("Initializing GeneralSettings");

    let store = match GeneralSettings::get(app) {
        Ok(Some(store)) => store,
        Ok(None) => GeneralSettings::default(),
        e => {
            e.unwrap();
            return;
        }
    };

    store.save(app).unwrap();

    println!("GeneralSettings managed");
}
