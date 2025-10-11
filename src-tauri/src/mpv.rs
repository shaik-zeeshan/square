use std::{
    sync::mpsc::{Receiver, Sender},
    time::Duration,
};

use gl::types::GLsizei;
use glutin::{
    config::{ConfigTemplateBuilder, GlConfig},
    context::{ContextApi, ContextAttributesBuilder, PossiblyCurrentContext, Version},
    display::{Display, GetGlDisplay},
    prelude::{GlDisplay, NotCurrentGlContext},
    surface::{GlSurface, Surface, SurfaceAttributesBuilder, WindowSurface},
};
use libmpv2::{
    events::PropertyData,
    render::{OpenGLInitParams, RenderContext, RenderParam, RenderParamApiType},
    Mpv,
};
use raw_window_handle::{HasDisplayHandle, HasWindowHandle};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, PhysicalSize, Window};

const DEFAULT_AUDIO_LANG: &str = "en";
const DEFAULT_SUBTITLE_LANG: &str = "en";

fn get_proc_address_fn(ctx: &*mut std::ffi::c_void, name: &str) -> *mut std::ffi::c_void {
    use std::ffi::CString;

    // Cast the context back to a display pointer
    let display_ptr = *ctx as *const glutin::display::Display;

    if let Ok(c_name) = CString::new(name) {
        unsafe { (*display_ptr).get_proc_address(&c_name).cast_mut() }
    } else {
        std::ptr::null_mut()
    }
}

fn create_gl_context(
    window: Window,
) -> Result<(Display, Surface<WindowSurface>, PossiblyCurrentContext), Box<dyn std::error::Error>> {
    let raw_display_handle = window
        .display_handle()
        .expect("Failed to get display handle")
        .as_raw();

    // Create glutin display
    let gl_display = unsafe {
        glutin::display::Display::new(
            raw_display_handle,
            glutin::display::DisplayApiPreference::Cgl, // or other preferences
        )
        .map_err(|e| format!("Failed to create GL display: {}", e))?
    };

    let raw_handle = window.window_handle().unwrap().as_raw();

    let configs = unsafe {
        gl_display
            .find_configs(
                ConfigTemplateBuilder::new()
                    .with_alpha_size(8)
                    .with_transparency(true)
                    .build(),
            )
            .unwrap()
    };

    let gl_config = configs
        .reduce(|accum, config| {
            let transparency_check = config.supports_transparency().unwrap_or(false)
                & !accum.supports_transparency().unwrap_or(false);

            if transparency_check || config.num_samples() < accum.num_samples() {
                config
            } else {
                accum
            }
        })
        .unwrap();

    let context_attributes = ContextAttributesBuilder::new()
        .with_context_api(ContextApi::OpenGl(Some(Version::new(3, 3))))
        .build(Some(raw_handle));

    let not_current_gl_context =
        unsafe { gl_display.create_context(&gl_config, &context_attributes)? };

    let (width, height): (u32, u32) = window.inner_size().unwrap().into();

    let surface_attributes = SurfaceAttributesBuilder::<WindowSurface>::new().build(
        raw_handle,
        std::num::NonZeroU32::new(width).unwrap_or(std::num::NonZeroU32::new(1).unwrap()),
        std::num::NonZeroU32::new(height).unwrap_or(std::num::NonZeroU32::new(1).unwrap()),
    );

    let surface = unsafe {
        gl_config
            .display()
            .create_window_surface(&gl_config, &surface_attributes)?
    };

    let gl_context = not_current_gl_context.make_current(&surface)?;

    Ok((gl_display, surface, gl_context))
}

fn render(
    render_context: &RenderContext,
    context: &PossiblyCurrentContext,
    surface: &Surface<WindowSurface>,
    window: &Window,
) {
    let (width, height): (u32, u32) = window
        .inner_size()
        .unwrap_or(PhysicalSize::new(1920, 1080))
        .into();

    // Try to render with timeout
    match render_context.render::<()>(0, width as _, height as _, true) {
        Ok(_) => {
            // Only swap buffers if render succeeded
            if let Err(e) = surface.swap_buffers(context) {
                eprintln!("Failed to swap buffers: {}", e);
            }
        }
        Err(e) => {
            eprintln!("Failed to render: {}", e);
            return;
        }
    }
}

fn clear_to_transparent(
    context: &PossiblyCurrentContext,
    surface: &Surface<WindowSurface>,
    window: &Window,
) {
    let (width, height): (u32, u32) = window
        .inner_size()
        .unwrap_or(PhysicalSize::new(1920, 1080))
        .into();

    unsafe {
        // Load OpenGL functions
        gl::load_with(|s| {
            let c_str = std::ffi::CString::new(s).unwrap();
            context.display().get_proc_address(&c_str) as *const _
        });

        // Set viewport
        gl::Viewport(0, 0, width as GLsizei, height as GLsizei);

        // Enable blending for transparency
        gl::Enable(gl::BLEND);
        gl::BlendFunc(gl::SRC_ALPHA, gl::ONE_MINUS_SRC_ALPHA);

        // Clear to transparent (RGBA: 0, 0, 0, 0)
        gl::ClearColor(0.0, 0.0, 0.0, 0.0);
        gl::Clear(gl::COLOR_BUFFER_BIT);

        // Swap buffers to display the transparent screen
        if let Err(e) = surface.swap_buffers(context) {
            eprintln!("Failed to swap buffers after clearing: {}", e);
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub enum PlaybackEvent {
    Play,
    Pause,
    Seek(f64),
    Volume(f64),
    Speed(f64),
    EndOfFile,
    Error(String),
    ChangeSubtitle(String),
    ChangeAudio(String),
    Resize(u32, u32),
    Load(String),
    Clear,
    Redraw,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MpvEvent {
    event: PlaybackEvent,
    payload: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Track {
    id: i64,
    #[serde(rename = "type")]
    media_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    lang: Option<String>,
}

pub async fn run_render_thread(
    window: Window,
    render_tx: Sender<PlaybackEvent>,
    render_rx: Receiver<PlaybackEvent>,
) {
    // Create OpenGL context on this thread
    let (display, surface, context) = create_gl_context(window.clone()).unwrap();
    eprintln!("OpenGL context created successfully on render thread");

    // Initialize MPV on this thread
    let mut mpv = Mpv::new().unwrap();

    mpv.set_property("vo", "libmpv").unwrap();
    mpv.set_property("idle", "yes").unwrap();
    mpv.set_property("pause", true).unwrap();

    mpv.set_property("input-ipc-server", "/tmp/sreal").unwrap();

    mpv.observe_property("pause", libmpv2::Format::Flag, 1)
        .unwrap();
    mpv.observe_property("time-pos", libmpv2::Format::String, 2)
        .unwrap();
    mpv.observe_property("track-list", libmpv2::Format::String, 3)
        .unwrap();
    mpv.observe_property("duration", libmpv2::Format::String, 4)
        .unwrap();
    mpv.observe_property("aid", libmpv2::Format::String, 5)
        .unwrap();
    mpv.observe_property("sid", libmpv2::Format::String, 6)
        .unwrap();
    mpv.observe_property("speed", libmpv2::Format::Double, 7)
        .unwrap();

    mpv.disable_deprecated_events().unwrap();

    let mut render_context = RenderContext::new(
        unsafe { mpv.ctx.as_mut() },
        vec![
            RenderParam::ApiType(RenderParamApiType::OpenGl),
            RenderParam::InitParams(OpenGLInitParams {
                get_proc_address: get_proc_address_fn,
                ctx: &display as *const _ as *mut std::ffi::c_void,
            }),
        ],
    )
    .unwrap();

    // Set up MPV update callback to trigger rendering on this thread
    render_context.set_update_callback({
        let render_tx = render_tx.clone();
        move || {
            let _ = render_tx.send(PlaybackEvent::Redraw);
        }
    });

    // Combined event loop - handle both MPV events and render signals
    loop {
        // Check for MPV events
        if let Some(event) = mpv.wait_event(0.0) {
            if let Ok(event) = event {
                handle_mpv_events(event, &window, render_tx.clone());
            };
        }

        // Check for render signals (non-blocking)
        //if let Ok(event) = render_rx.try_recv() {
        if let Ok(event) = render_rx.recv() {
            match event {
                PlaybackEvent::Redraw => {
                    //mpv.set_property("pause", false)
                    render(&render_context, &context, &surface, &window);
                }
                PlaybackEvent::Resize(width, height) => {
                    surface.resize(
                        &context,
                        std::num::NonZeroU32::new(width)
                            .unwrap_or(std::num::NonZeroU32::new(1).unwrap()),
                        std::num::NonZeroU32::new(height)
                            .unwrap_or(std::num::NonZeroU32::new(1).unwrap()),
                    );
                }

                PlaybackEvent::Clear => {
                    mpv.set_property("pause", true).unwrap();
                    // Clear to transparent screen using OpenGL
                    clear_to_transparent(&context, &surface, &window);
                }

                _ => handle_playback_event(event, &mpv),
            }
        }

        //std::thread::sleep(std::time::Duration::from_millis(fps.into())); // ~40 FPS
    }
}

fn handle_playback_event(event: PlaybackEvent, mpv: &Mpv) {
    let loaded_file = !mpv.get_property::<bool>("idle-active").unwrap();
    match event {
        PlaybackEvent::Play => {
            mpv.set_property("pause", false).unwrap();
        }

        PlaybackEvent::Pause => {
            mpv.set_property("pause", true).unwrap();
        }

        PlaybackEvent::Seek(time) => {
            if loaded_file {
                mpv.command("seek", &[&time.to_string(), "relative"])
                    .unwrap();
            }
        }

        PlaybackEvent::Volume(volume) => {
            mpv.set_property("volume", volume).unwrap();
        }

        PlaybackEvent::Speed(speed) => {
            mpv.set_property("speed", speed).unwrap();
        }

        PlaybackEvent::EndOfFile => {
            // mpv.set_property("pause", true).unwrap();
        }

        PlaybackEvent::Error(error) => {
            eprintln!("Error: {}", error);
        }

        PlaybackEvent::ChangeSubtitle(subtitle) => {
            mpv.set_property("sid", subtitle).unwrap();
        }

        PlaybackEvent::ChangeAudio(audio) => {
            mpv.set_property("aid", audio).unwrap();
        }

        PlaybackEvent::Load(url) => {
            mpv.command("loadfile", &[&url, "replace"]).unwrap();
            mpv.set_property("pause", false).unwrap();
        }

        _ => {}
    }
}

fn handle_mpv_events(
    event: libmpv2::events::Event,
    window: &Window,
    render_tx: Sender<PlaybackEvent>,
) {
    match event {
        libmpv2::events::Event::FileLoaded => {}

        libmpv2::events::Event::PropertyChange {
            name: "pause",
            change: PropertyData::Flag(pause),
            reply_userdata: 1,
        } => {
            window.emit("pause", pause).unwrap();
        }
        libmpv2::events::Event::PropertyChange {
            name: "time-pos",
            change: PropertyData::Str(time),
            reply_userdata: 2,
        } => {
            window.emit("playback-time", time).unwrap();
        }
        libmpv2::events::Event::PropertyChange {
            name: "duration",
            change: PropertyData::Str(duration),
            reply_userdata: 4,
        } => {
            let dur = Duration::from_secs_f64(duration.parse().expect("duration failed to f64"));
            window.emit("duration", dur.as_secs_f64()).unwrap();
        }
        libmpv2::events::Event::PropertyChange {
            name: "track-list",
            change: PropertyData::Str(data),
            reply_userdata: 3,
        } => {
            let mut audio_tracks = Vec::new();
            let mut subtitle_tracks = Vec::new();

            match serde_json::from_str::<Vec<Track>>(data) {
                Ok(track_list) => {
                    track_list.iter().for_each(|track| {
                        if track.media_type == "video" {
                            return;
                        };

                        if track.media_type == "audio" {
                            audio_tracks.push(track);
                        } else if track.media_type == "sub" {
                            subtitle_tracks.push(track);
                        }
                    });
                    window.emit("audio-list", audio_tracks.clone()).unwrap();
                    window
                        .emit("subtitle-list", subtitle_tracks.clone())
                        .unwrap();
                }

                Err(err) => {
                    println!(
                        "Error occured when serializing (track-list): {}",
                        err.to_string()
                    )
                }
            };
        }
        libmpv2::events::Event::PropertyChange {
            name: "aid",
            change: PropertyData::Str(aid),
            reply_userdata: 5,
        } => {
            window.emit("aid", aid).unwrap();
        }

        libmpv2::events::Event::PropertyChange {
            name: "sid",
            change: PropertyData::Str(sid),
            reply_userdata: 6,
        } => {
            window.emit("sid", sid).unwrap();
        }

        libmpv2::events::Event::PropertyChange {
            name: "speed",
            change: PropertyData::Double(speed),
            reply_userdata: 7,
        } => {
            window.emit("speed", speed).unwrap();
        }

        libmpv2::events::Event::EndFile(reason) => {
            eprintln!("MPV: End of file: {:?}", reason);
            render_tx.send(PlaybackEvent::EndOfFile).unwrap();
        }
        _ => {}
    }
}
