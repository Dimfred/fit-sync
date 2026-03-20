mod file_watcher;

use tauri::{
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
    tray::TrayIconBuilder,
    menu::{MenuBuilder, MenuItemBuilder},
    image::Image,
};

#[tauri::command]
async fn open_garmin_auth(app: tauri::AppHandle, auth_url: String) -> Result<(), String> {
    let width = (900.0 * 0.85) as f64;
    let height = (650.0 * 0.85) as f64;

    let app_handle = app.clone();
    let builder = WebviewWindowBuilder::new(&app, "garmin-auth", WebviewUrl::External(auth_url.parse().map_err(|e| format!("{e}"))?))
        .title("Connect to Garmin")
        .inner_size(width, height)
        .center()
        .resizable(false)
        .on_navigation(move |url| {
            let url_str = url.to_string();
            if url_str.contains("ticket=") {
                let _ = app_handle.emit("garmin-auth-ticket", url_str);
            }
            true
        });

    builder.build().map_err(|e| format!("{e}"))?;
    Ok(())
}

#[tauri::command]
async fn close_garmin_auth(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("garmin-auth") {
        window.close().map_err(|e| format!("{e}"))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(file_watcher::FitWatcherState::default())
        .invoke_handler(tauri::generate_handler![
            open_garmin_auth,
            close_garmin_auth,
            file_watcher::start_fit_watch,
            file_watcher::stop_fit_watch,
            file_watcher::stop_all_fit_watches,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Build tray menu
            let show = MenuItemBuilder::with_id("show", "Show").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show)
                .item(&quit)
                .build()?;

            let icon = Image::from_path("icons/tray-icon.png")
                .unwrap_or_else(|_| Image::from_bytes(include_bytes!("../icons/tray-icon.png")).expect("failed to load tray icon"));

            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .tooltip("FIT Sync")
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if matches!(event, tauri::tray::TrayIconEvent::Click { .. }) {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Hide instead of close
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
