use std::str::FromStr;

use keyring::Entry;
use rand::Rng;
use specta::specta;
use tauri::{Manager, WebviewBuilder, WindowBuilder, Wry};
use tauri_plugin_http;
use tauri_specta::{collect_events, Event};

use crate::mpv::{
    run_render_thread, AudioChangeEvent, AudioTrackChange, BufferingStateChange, CacheTimeChange,
    EOFEventChange, ErrorEventChange, FileLoadedChange, PauseForCacheChange, PlayBackStateChange,
    PlayBackTimeChange, PlaybackEvent, RequestAudioEvent, RequestClearEvent, RequestFileLoad,
    RequestPlayBackState, RequestSeekEvent, RequestSpeedEvent, RequestSubtitleEvent,
    RequestVolumeEvent, SpeedEventChange, SubtitleChangeEvent, SubtitleTrackChange, Track,
    VolumeEventChange,
};

// Credential operations are handled by the frontend JavaScript API

mod credentials;
pub mod mpv;
mod store;

static VAULT_PASSWORD: std::sync::OnceLock<String> = std::sync::OnceLock::new();

/// Application state shared across Tauri commands
#[derive(Clone)]
struct AppState {
    render_tx: std::sync::mpsc::Sender<PlaybackEvent>,
    pip_window: std::sync::Arc<std::sync::Mutex<Option<tauri::Window>>>,
}

/// Helper function to send events to render thread with error logging
fn send_render_event(app: &tauri::AppHandle, event: PlaybackEvent) -> Result<(), String> {
    let app_state = app.state::<AppState>();
    app_state
        .render_tx
        .send(event)
        .map_err(|e| format!("Failed to send event to render thread: {}", e))
}

fn generate_password() -> Result<String, String> {
    let password = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(32)
        .map(char::from)
        .collect::<String>();
    Ok(password)
}

#[specta]
#[tauri::command]
fn get_vault_password(app: tauri::AppHandle) -> Result<String, String> {
    if let Some(password) = VAULT_PASSWORD.get() {
        log::debug!("Retrieved vault password from cache");
        return Ok(password.clone());
    }

    let app_name = app.config().product_name.as_ref().unwrap().clone();
    let entry = Entry::new(&app_name, "square_credentials").map_err(|er| {
        let err = format!("entry error {}", er.to_string());
        log::error!("{}", err);
        err
    })?;

    match entry.get_password() {
        Ok(password) => {
            log::debug!("Successfully retrieved vault password from keyring");
            // Store the retrieved password in OnceLock for future calls
            let _ = VAULT_PASSWORD.set(password.clone());
            Ok(password)
        }
        Err(err) => {
            log::error!("Failed to get vault password: {}", err);
            log::debug!("Generating new password");
            let password = generate_password()?;
            entry.set_password(&password).map_err(|err| {
                let err = format!("setting password error: {}", err);
                log::error!("{}", err);
                err
            })?;
            let _ = VAULT_PASSWORD.set(password.clone());
            log::debug!("Successfully generated and stored new vault password");
            Ok(password)
        }
    }
}

// ===== PLAYBACK CONTROL COMMANDS =====

/// Start or resume playback
#[specta]
#[tauri::command]
fn playback_play(app: tauri::AppHandle) {
    if let Err(e) = send_render_event(&app, PlaybackEvent::Play) {
        log::error!("{}", e);
    }
}

/// Pause playback
#[specta]
#[tauri::command]
fn playback_pause(app: tauri::AppHandle) {
    if let Err(e) = send_render_event(&app, PlaybackEvent::Pause) {
        log::error!("{}", e);
    }
}

/// Seek to a relative time position
#[specta]
#[tauri::command]
fn playback_seek(app: tauri::AppHandle, time: f64) {
    let _ = send_render_event(&app, PlaybackEvent::Seek(time));
}

/// Seek to an absolute time position
#[specta]
#[tauri::command]
fn playback_absolute_seek(app: tauri::AppHandle, time: f64) {
    let _ = send_render_event(&app, PlaybackEvent::AbsoluteSeek(time));
}

/// Set playback volume (0.0 - 100.0)
#[specta]
#[tauri::command]
fn playback_volume(app: tauri::AppHandle, volume: u8) {
    let _ = send_render_event(&app, PlaybackEvent::Volume(volume));
}

/// Set playback speed
#[specta]
#[tauri::command]
fn playback_speed(app: tauri::AppHandle, speed: f64) {
    let _ = send_render_event(&app, PlaybackEvent::Speed(speed));
}

/// Load a media file URL
#[specta]
#[tauri::command]
fn playback_load(app: tauri::AppHandle, url: String) {
    if let Err(e) = send_render_event(&app, PlaybackEvent::Load(url, None)) {
        log::error!("{}", e);
    }
}

/// Change subtitle track
#[specta]
#[tauri::command]
fn playback_change_subtitle(app: tauri::AppHandle, subtitle: String) {
    let _ = send_render_event(&app, PlaybackEvent::ChangeSubtitle(subtitle));
}

/// Change audio track
#[specta]
#[tauri::command]
fn playback_change_audio(app: tauri::AppHandle, audio: String) {
    let _ = send_render_event(&app, PlaybackEvent::ChangeAudio(audio));
}

/// Clear current playback
#[specta]
#[tauri::command]
fn playback_clear(app: tauri::AppHandle) {
    let _ = send_render_event(&app, PlaybackEvent::Clear);
}

// ===== PICTURE IN PICTURE (PIP) COMMANDS =====

/// Show PiP window (makes it visible)
#[specta]
#[tauri::command]
fn show_pip_window(app: tauri::AppHandle) -> Result<(), String> {
    let app_clone = app.clone();
    let app_state = app.state::<AppState>();
    let pip_window_guard = app_state.pip_window.lock().unwrap();

    if let Some(pip_window) = pip_window_guard.as_ref() {
        pip_window
            .show()
            .map_err(|e| format!("Failed to show PiP window: {}", e))?;
        log::info!("PiP window shown");
        switch_render_window(app_clone, "pip".to_string()).unwrap();
        Ok(())
    } else {
        Err("PiP window not available".to_string())
    }
}

fn switch_render_window(app: tauri::AppHandle, target: String) -> Result<(), String> {
    let _ = send_render_event(&app, PlaybackEvent::SwitchTarget(target));
    Ok(())
}

/// Hide PiP window (makes it invisible)
#[specta]
#[tauri::command]
fn hide_pip_window(app: tauri::AppHandle) -> Result<(), String> {
    let app_clone = app.clone();
    let app_state = app.state::<AppState>();
    let pip_window_guard = app_state.pip_window.lock().unwrap();

    if let Some(pip_window) = pip_window_guard.as_ref() {
        pip_window
            .hide()
            .map_err(|e| format!("Failed to hide PiP window: {}", e))?;
        log::info!("PiP window hidden");
        switch_render_window(app_clone, "main".to_string()).unwrap();
        Ok(())
    } else {
        Err("PiP window not available".to_string())
    }
}

/// Toggle PiP window visibility
#[specta]
#[tauri::command]
fn toggle_pip_window(app: tauri::AppHandle) -> Result<(), String> {
    let app_clone = app.clone();
    let app_state = app.state::<AppState>();
    let pip_window_guard = app_state.pip_window.lock().unwrap();

    if let Some(pip_window) = pip_window_guard.as_ref() {
        let is_visible = pip_window
            .is_visible()
            .map_err(|e| format!("Failed to get PiP window visibility: {}", e))?;

        if is_visible {
            pip_window
                .hide()
                .map_err(|e| format!("Failed to hide PiP window: {}", e))?;
            log::info!("PiP window hidden");
            switch_render_window(app_clone, "main".to_string()).unwrap();
        } else {
            pip_window
                .show()
                .map_err(|e| format!("Failed to show PiP window: {}", e))?;
            log::info!("PiP window shown");
            switch_render_window(app_clone, "pip".to_string()).unwrap();
        }
        Ok(())
    } else {
        Err("PiP window not available".to_string())
    }
}

// ===== WINDOW CONTROL COMMANDS =====

/// Toggle fullscreen mode for main window
#[specta]
#[tauri::command]
fn toggle_fullscreen(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    let is_fullscreen = window
        .is_fullscreen()
        .map_err(|e| format!("Failed to get fullscreen state: {}", e))?;

    log::info!(
        "Current fullscreen state: {}, toggling to: {}",
        is_fullscreen,
        !is_fullscreen
    );

    // Use native Tauri fullscreen method without custom style mask manipulation
    window
        .set_fullscreen(!is_fullscreen)
        .map_err(|e| format!("Failed to set fullscreen state: {}", e))?;

    Ok(())
}

/// Helper function to create PiP window with proper configuration
fn create_pip_window(handle: &tauri::AppHandle) -> Result<tauri::Window, String> {
    // Create PiP window
    let pip_window = tauri::WindowBuilder::new(handle, "pip")
        .title("Picture in Picture")
        .inner_size(400.0, 225.0) // 16:9 aspect ratio
        .min_inner_size(200.0, 112.0)
        .position(16.0, 16.0)
        .resizable(true)
        .always_on_top(true)
        .transparent(true)
        .visible_on_all_workspaces(true)
        .visible(false) // Start hidden
        .shadow(false)
        .skip_taskbar(false)
        .build()
        .map_err(|e| format!("Failed to create PiP window: {}", e))?;

    // Apply frameless styling
    make_frameless_window(&pip_window)
        .map_err(|e| format!("Failed to make frameless window: {}", e))?;

    // Create transparent webview for PiP
    let pip_webview =
        tauri::WebviewBuilder::new("pip", tauri::WebviewUrl::App("/pip".into())).transparent(true);

    pip_window
        .add_child(
            pip_webview,
            tauri::LogicalPosition::new(0, 0),
            pip_window.inner_size().unwrap(),
        )
        .map_err(|e| format!("Failed to add webview to PiP window: {}", e))?;

    Ok(pip_window)
}

fn toggle_titlebar(window: &tauri::Window, hide: bool) -> Result<(), String> {
    // Check if window is in fullscreen mode - if so, don't modify style mask
    if let Ok(is_fullscreen) = window.is_fullscreen() {
        if is_fullscreen {
            log::info!("Window is in fullscreen mode, skipping titlebar manipulation");
            return Ok(());
        }
    }

    let ns_window = window
        .ns_window()
        .map_err(|e| format!("Failed to get NS window handle: {}", e))?;

    unsafe {
        use objc2_app_kit::NSWindowButton;

        let objc_window = ns_window as *mut objc2_app_kit::NSWindow;
        let window = objc_window.as_ref().unwrap();

        let close_button = window
            .standardWindowButton(NSWindowButton::CloseButton)
            .unwrap();
        let min_button = window
            .standardWindowButton(NSWindowButton::MiniaturizeButton)
            .unwrap();
        let zoom_button = window
            .standardWindowButton(NSWindowButton::ZoomButton)
            .unwrap();

        // Hide the close button
        close_button.setHidden(hide);

        // Hide the minimize button
        min_button.setHidden(hide);

        // Hide the zoom button
        zoom_button.setHidden(hide);
    }

    Ok(())
}

fn make_frameless_window(window: &tauri::Window) -> Result<(), String> {
    // let _ = toggle_titlebar(window, true).map_err(|e| format!("failed to hide titlebar"))?;

    let ns_window = window
        .ns_window()
        .map_err(|e| format!("Failed to get NS window handle: {}", e))?;

    unsafe {
        use objc2_app_kit::{
            NSFloatingWindowLevel, NSWindowButton, NSWindowCollectionBehavior,
            NSWindowTitleVisibility,
        };

        let objc_window = ns_window as *mut objc2_app_kit::NSWindow;
        let window = objc_window.as_ref().unwrap();

        let close_button = window
            .standardWindowButton(NSWindowButton::CloseButton)
            .unwrap();
        let min_button = window
            .standardWindowButton(NSWindowButton::MiniaturizeButton)
            .unwrap();
        let zoom_button = window
            .standardWindowButton(NSWindowButton::ZoomButton)
            .unwrap();

        close_button.setHidden(true);
        min_button.setHidden(true);
        zoom_button.setHidden(true);

        window.setTitleVisibility(NSWindowTitleVisibility::Hidden);
        window.setTitlebarAppearsTransparent(true);

        window.setLevel(NSFloatingWindowLevel);

        // window.setMovableByWindowBackground(true);

        window.setCollectionBehavior(
            NSWindowCollectionBehavior::CanJoinAllSpaces
                | NSWindowCollectionBehavior::Stationary
                | NSWindowCollectionBehavior::FullScreenAuxiliary
                | NSWindowCollectionBehavior::Transient
                | NSWindowCollectionBehavior::IgnoresCycle,
        );
    };

    Ok(())
}

#[specta]
#[tauri::command]
fn toggle_titlebar_hide(app: tauri::AppHandle, hide: bool) -> Result<(), String> {
    let window = app
        .get_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    toggle_titlebar(&window, hide)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub async fn run() {
    let tauri_context = tauri::generate_context!();

    tauri::async_runtime::set(tokio::runtime::Handle::current());

    let specta_builder = tauri_specta::Builder::<Wry>::new()
        .commands(tauri_specta::collect_commands![
            playback_play,
            playback_pause,
            playback_seek,
            playback_absolute_seek,
            playback_volume,
            playback_speed,
            playback_load,
            playback_change_subtitle,
            playback_change_audio,
            playback_clear,
            toggle_titlebar_hide,
            toggle_fullscreen,
            show_pip_window,
            hide_pip_window,
            toggle_pip_window,
            get_vault_password
        ])
        .events(collect_events![
            // Request Events
            RequestPlayBackState,
            RequestFileLoad,
            RequestSeekEvent,
            RequestSubtitleEvent,
            RequestAudioEvent,
            RequestVolumeEvent,
            PlayBackTimeChange,
            PlayBackStateChange,
            RequestClearEvent,
            RequestSpeedEvent,
            // Change Events
            FileLoadedChange,
            SpeedEventChange,
            EOFEventChange,
            VolumeEventChange,
            ErrorEventChange,
            SubtitleChangeEvent,
            AudioChangeEvent,
            SubtitleTrackChange,
            AudioTrackChange,
            CacheTimeChange,
            PauseForCacheChange,
            BufferingStateChange
        ])
        .typ::<Track>()
        .error_handling(tauri_specta::ErrorHandlingMode::Throw)
        .typ::<store::GeneralSettings>();

    #[cfg(debug_assertions)]
    specta_builder
        .export(
            specta_typescript::Typescript::default(),
            "../src/lib/tauri.ts",
        )
        .expect("Failed to export typescript bindings");

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(specta_builder.invoke_handler())
        .setup(move |app| {
            let app_clone = app.handle().clone();
            specta_builder.mount_events(&app_clone);

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            };

            // Initialize Stronghold plugin for frontend use
            let app_data_dir = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path");

            // Ensure the directory exists
            std::fs::create_dir_all(&app_data_dir)
                .map_err(|e| format!("Failed to create app data directory: {}", e))?;

            let salt_path = app_data_dir.join("salt.txt");

            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;

            let handle = app.handle().clone();

            let window = WindowBuilder::new(&handle, "main")
                .title("square")
                .hidden_title(true)
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .build()
                .unwrap();

            // webview should be transparent if window url start with /video
            let webview =
                WebviewBuilder::new("main", tauri::WebviewUrl::App("/".into())).transparent(true);

            window
                .add_child(
                    webview,
                    tauri::LogicalPosition::new(0, 0),
                    window.inner_size().unwrap(),
                )
                .unwrap();

            // Create PiP window at startup (hidden by default)
            let pip_window = create_pip_window(&handle)
                .map_err(|e| format!("Failed to create PiP window at startup: {}", e))?;
            log::info!("PiP window created at startup (hidden)");

            // Create channel for render signals
            let (render_tx, render_rx) = std::sync::mpsc::channel::<PlaybackEvent>();

            let app_state = AppState {
                render_tx: render_tx.clone(),
                pip_window: std::sync::Arc::new(std::sync::Mutex::new(Some(pip_window.clone()))),
            };

            // Move all MPV and OpenGL setup to a dedicated thread
            let window_clone = window.clone();
            let app_state_clone = app_state.clone();
            let pip_window_clone = pip_window.clone();
            let get_pip_window =
                Box::new(move || app_state_clone.pip_window.lock().unwrap().clone());

            let tx = render_tx.clone();
            tokio::spawn(run_render_thread(
                window_clone,
                render_tx,
                render_rx,
                pip_window_clone,
                get_pip_window,
            ));

            let playback_tx = tx.clone();
            RequestPlayBackState::listen_any(&app_clone, move |event| {
                if event.payload.pause {
                    playback_tx.send(PlaybackEvent::Pause).ok()
                } else {
                    playback_tx.send(PlaybackEvent::Play).ok()
                };
            });

            let playback_tx = tx.clone();
            RequestSeekEvent::listen_any(&app_clone, move |event| {
                if event.payload.absolute {
                    playback_tx
                        .send(PlaybackEvent::AbsoluteSeek(event.payload.position))
                        .ok()
                } else {
                    playback_tx
                        .send(PlaybackEvent::Seek(event.payload.position))
                        .ok()
                };
            });

            let playback_tx = tx.clone();
            RequestVolumeEvent::listen_any(&app_clone, move |event| {
                playback_tx
                    .send(PlaybackEvent::Volume(event.payload.percentage))
                    .ok();
            });

            let playback_tx = tx.clone();
            RequestSpeedEvent::listen_any(&app_clone, move |event| {
                playback_tx
                    .send(PlaybackEvent::Speed(event.payload.speed))
                    .ok();
            });

            let playback_tx = tx.clone();
            RequestSpeedEvent::listen_any(&app_clone, move |event| {
                playback_tx
                    .send(PlaybackEvent::Speed(event.payload.speed))
                    .ok();
            });

            let playback_tx = tx.clone();
            RequestFileLoad::listen_any(&app_clone, move |event| {
                playback_tx
                    .send(PlaybackEvent::Load(
                        event.payload.url,
                        event.payload.start_time,
                    ))
                    .ok();
            });

            let playback_tx = tx.clone();
            RequestFileLoad::listen_any(&app_clone, move |event| {
                playback_tx
                    .send(PlaybackEvent::Load(
                        event.payload.url,
                        event.payload.start_time,
                    ))
                    .ok();
            });

            let playback_tx = tx.clone();
            RequestSubtitleEvent::listen_any(&app_clone, move |event| {
                playback_tx
                    .send(PlaybackEvent::ChangeSubtitle(event.payload.index))
                    .ok();
            });

            let playback_tx = tx.clone();
            RequestAudioEvent::listen_any(&app_clone, move |event| {
                playback_tx
                    .send(PlaybackEvent::ChangeAudio(event.payload.index))
                    .ok();
            });

            let playback_tx = tx.clone();
            RequestClearEvent::listen_any(&app_clone, move |_| {
                playback_tx.send(PlaybackEvent::Clear).ok();
            });

            app.manage(app_state);

            Ok(())
        })
        .on_window_event(|_window, event| {
            match event {
                _ => {}
            };
        })
        .build(tauri_context)
        .expect("error while running tauri application");

    app.run(|_app, event| {
        let app_state = _app.state::<AppState>();
        match event {
            tauri::RunEvent::ExitRequested { code, .. } => {
                println!("ExitRequested: {:?}", code);
            }
            tauri::RunEvent::WindowEvent { label, event, .. } => {
                match event {
                    tauri::WindowEvent::Resized(physical_size) => {
                        let (width, height): (u32, u32) = physical_size.into();

                        // Only send resize events for the main window to avoid affecting PiP rendering
                        if label == "main" {
                            if let Err(e) = app_state
                                .render_tx
                                .send(PlaybackEvent::Resize(width, height))
                            {
                                log::error!("Failed to send resize event to render thread: {}", e);
                            }

                            if let Some(webview) = _app.get_webview("main") {
                                if let Err(e) = webview.set_size(physical_size) {
                                    log::error!("Failed to resize webview: {}", e);
                                }

                                let _ = webview.set_focus();
                            } else {
                                log::warn!("Main webview not found during resize");
                            }
                        } else if label == "pip" {
                            // Handle PiP window resize separately
                            if let Some(webview) = _app.get_webview("pip") {
                                if let Err(e) = webview.set_size(physical_size) {
                                    log::error!("Failed to resize PiP webview: {}", e);
                                }
                            }

                            // Send PiP resize event to render thread
                            if let Err(e) = app_state
                                .render_tx
                                .send(PlaybackEvent::ResizePipWindow { width, height })
                            {
                                log::error!(
                                    "Failed to send PiP resize event to render thread: {}",
                                    e
                                );
                            }
                        }
                    }
                    tauri::WindowEvent::CloseRequested { .. } => {
                        if let Some(window) = _app.get_window(&label) {
                            window.destroy().unwrap();
                        } else {
                            log::warn!("Main not found during close request");
                        };
                    }
                    tauri::WindowEvent::Destroyed => {
                        if label != "main".to_string() {
                            return;
                        };
                        if let Some(window) = _app.get_window("pip") {
                            window.destroy().unwrap();
                        } else {
                            log::warn!("{} window not found during destory", label);
                        };
                    }
                    _ => {}
                };
            }
            _ => {}
        };
    });
}
