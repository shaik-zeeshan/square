fn main() {
    // FFmpeg will be built automatically by ffmpeg-sys-next with build feature
    
    // Tell libmpv2 where to find our custom-built dynamic MPV library
    let mpv_lib_path = std::env::current_dir()
        .unwrap()
        .parent()
        .unwrap()
        .join("lib")
        .join("dylib");
    
    println!("cargo:rustc-link-search=native={}", mpv_lib_path.display());
    println!("cargo:rustc-link-lib=dylib=mpv");
    
    // Copy dynamic libraries to target directory for testing
    let target_dir = std::env::var("OUT_DIR").unwrap();
    let target_frameworks = std::path::Path::new(&target_dir)
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("Frameworks");
    
    if !target_frameworks.exists() {
        std::fs::create_dir_all(&target_frameworks).unwrap();
    }
    
    // Copy all dylib files to the target Frameworks directory
    if let Ok(entries) = std::fs::read_dir(&mpv_lib_path) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("dylib") {
                    let filename = path.file_name().unwrap();
                    let dest_path = target_frameworks.join(filename);
                    if let Err(e) = std::fs::copy(&path, &dest_path) {
                        eprintln!("Warning: Failed to copy {} to {}: {}", 
                            path.display(), dest_path.display(), e);
                    }
                }
            }
        }
    }
    
    // Run code signing script for dynamic libraries
    let script_path = std::env::current_dir()
        .unwrap()
        .join("scripts")
        .join("sign-libs.sh");
    
    if script_path.exists() {
        let output = std::process::Command::new("bash")
            .arg(&script_path)
            .output();
        
        match output {
            Ok(result) => {
                if !result.status.success() {
                    eprintln!("Warning: Code signing script failed: {}", 
                        String::from_utf8_lossy(&result.stderr));
                }
            }
            Err(e) => {
                eprintln!("Warning: Failed to run code signing script: {}", e);
            }
        }
    }
    
    // Tell Tauri build system about our custom library
    tauri_build::build()
}