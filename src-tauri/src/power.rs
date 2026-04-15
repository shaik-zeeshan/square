#[cfg(target_os = "macos")]
use objc2::{rc::Retained, runtime::ProtocolObject};
#[cfg(target_os = "macos")]
use objc2_foundation::{NSActivityOptions, NSObjectProtocol, NSProcessInfo, NSString};

/// Keeps macOS awake while video playback is active.
pub struct PlaybackSleepBlocker {
    #[cfg(target_os = "macos")]
    activity: Option<Retained<ProtocolObject<dyn NSObjectProtocol>>>,
}

impl PlaybackSleepBlocker {
    pub fn new() -> Self {
        Self {
            #[cfg(target_os = "macos")]
            activity: None,
        }
    }

    pub fn set_enabled(&mut self, enabled: bool, reason: &str) {
        if enabled {
            self.enable(reason);
        } else {
            self.disable();
        }
    }

    pub fn enable(&mut self, reason: &str) {
        #[cfg(target_os = "macos")]
        {
            if self.activity.is_some() {
                return;
            }

            let options = NSActivityOptions::IdleSystemSleepDisabled
                | NSActivityOptions::IdleDisplaySleepDisabled;
            let reason = NSString::from_str(reason);
            let activity =
                NSProcessInfo::processInfo().beginActivityWithOptions_reason(options, &reason);

            self.activity = Some(activity);
            log::info!("Enabled macOS sleep prevention for active playback");
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = reason;
        }
    }

    pub fn disable(&mut self) {
        #[cfg(target_os = "macos")]
        {
            if let Some(activity) = self.activity.take() {
                let process_info = NSProcessInfo::processInfo();
                unsafe {
                    process_info.endActivity(&*activity);
                }
                log::info!("Released macOS sleep prevention for playback");
            }
        }
    }
}

impl Default for PlaybackSleepBlocker {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for PlaybackSleepBlocker {
    fn drop(&mut self) {
        self.disable();
    }
}
