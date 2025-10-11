use specta::specta;
use tauri::{Manager, WebviewBuilder, WindowBuilder, Wry};

use tauri_plugin_http;

use crate::mpv::{run_render_thread, PlaybackEvent};

pub mod mpv;
mod store;

struct AppState {
    render_tx: std::sync::mpsc::Sender<PlaybackEvent>,
}

#[specta]
#[tauri::command]
fn playback_play(app: tauri::AppHandle) {
    let app_state = app.state::<AppState>();
    let _ = app_state.render_tx.send(PlaybackEvent::Play);
}

#[specta]
#[tauri::command]
fn playback_pause(app: tauri::AppHandle) {
    let app_state = app.state::<AppState>();
    let _ = app_state.render_tx.send(PlaybackEvent::Pause);
}

#[specta]
#[tauri::command]
fn playback_seek(app: tauri::AppHandle, time: f64) {
    let app_state = app.state::<AppState>();
    let _ = app_state.render_tx.send(PlaybackEvent::Seek(time));
}

#[specta]
#[tauri::command]
fn playback_volume(app: tauri::AppHandle, volume: f64) {
    let app_state = app.state::<AppState>();
    let _ = app_state.render_tx.send(PlaybackEvent::Volume(volume));
}

#[specta]
#[tauri::command]
fn playback_speed(app: tauri::AppHandle, speed: f64) {
    let app_state = app.state::<AppState>();
    let _ = app_state.render_tx.send(PlaybackEvent::Speed(speed));
}

#[specta]
#[tauri::command]
fn playback_load(app: tauri::AppHandle, url: String) {
    let app_state = app.state::<AppState>();
    let _ = app_state.render_tx.send(PlaybackEvent::Load(url));
}

#[specta]
#[tauri::command]
fn playback_change_subtitle(app: tauri::AppHandle, subtitle: String) {
    let app_state = app.state::<AppState>();
    let _ = app_state
        .render_tx
        .send(PlaybackEvent::ChangeSubtitle(subtitle));
}

#[specta]
#[tauri::command]
fn playback_change_audio(app: tauri::AppHandle, audio: String) {
    let app_state = app.state::<AppState>();
    let _ = app_state.render_tx.send(PlaybackEvent::ChangeAudio(audio));
}

#[specta]
#[tauri::command]
fn playback_clear(app: tauri::AppHandle) {
    let app_state = app.state::<AppState>();
    let _ = app_state.render_tx.send(PlaybackEvent::Clear);
}

#[specta]
#[tauri::command]
fn toggle_fullscreen(app: tauri::AppHandle) {
    let window = app.get_webview_window("main").unwrap();
    let is_fullscreen = window.is_fullscreen().unwrap_or(false);
    let _ = window.set_fullscreen(!is_fullscreen);
}

fn toggle_titlebar(window: &tauri::Window, hide: bool) {
    let ns_window = window.ns_window().unwrap() as *mut cidre::ns::Window;
    unsafe {
        use cidre::ns::{WindowStyleMask, WindowTitleVisibility};
        let window = &mut *ns_window;

        // get style mask
        let mut style_mask = window.style_mask();

        style_mask.set(WindowStyleMask::FULL_SIZE_CONTENT_VIEW, true);

        if hide {
            style_mask.remove(
                WindowStyleMask::CLOSABLE
                    | WindowStyleMask::MINIATURIZABLE
                    | WindowStyleMask::RESIZABLE,
            );
        } else {
            style_mask.set(WindowStyleMask::RESIZABLE, true);
            style_mask.set(WindowStyleMask::CLOSABLE, true);
            style_mask.set(WindowStyleMask::MINIATURIZABLE, true);
        };

        let _ = window.set_style_mask(style_mask);

        window.set_title_visibility(WindowTitleVisibility::Hidden);

        window.set_titlebar_appears_transparent(true);
    }
}

#[specta]
#[tauri::command]
fn toggle_titlebar_hide(app: tauri::AppHandle, hide: bool) {
    let window = app.get_window("main").unwrap();
    toggle_titlebar(&window, hide);
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
            playback_volume,
            playback_speed,
            playback_load,
            playback_change_subtitle,
            playback_change_audio,
            playback_clear,
            toggle_titlebar_hide,
            toggle_fullscreen
        ])
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
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(specta_builder.invoke_handler())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            };

            let handle = app.handle().clone();

            let window = WindowBuilder::new(&handle, "main")
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

            // Create channel for render signals
            let (render_tx, render_rx) = std::sync::mpsc::channel::<PlaybackEvent>();

            let app_state = AppState {
                render_tx: render_tx.clone(),
            };

            // Move all MPV and OpenGL setup to a dedicated thread
            let window_clone = window.clone();
            tokio::spawn(run_render_thread(window_clone, render_tx, render_rx));

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
            tauri::RunEvent::WindowEvent { event, .. } => {
                match event {
                    tauri::WindowEvent::Resized(physical_size) => {
                        let (width, height): (u32, u32) = physical_size.into();
                        let _ = app_state
                            .render_tx
                            .send(PlaybackEvent::Resize(width, height));

                        let webview = _app.get_webview("main").unwrap();
                        webview.set_size(physical_size).unwrap();
                    }
                    _ => {}
                };
            }
            _ => {}
        };
    });
}
