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