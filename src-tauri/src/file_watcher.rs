use notify::{Event, EventKind, RecursiveMode, Watcher};
use notify::event::CreateKind;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(serde::Serialize, Clone)]
pub struct FitFileDetectedEvent {
    pub sync_id: String,
    pub path: String,
}

pub struct FitWatcherState {
    watchers: Mutex<HashMap<String, notify::RecommendedWatcher>>,
}

impl Default for FitWatcherState {
    fn default() -> Self {
        Self {
            watchers: Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
pub fn start_fit_watch(
    app: AppHandle,
    state: State<'_, FitWatcherState>,
    sync_id: String,
    path: String,
) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() || !path_buf.is_dir() {
        return Err(format!("Directory does not exist: {}", path));
    }

    stop_fit_watch_internal(&state, &sync_id);

    let app_handle = app.clone();
    let sid = sync_id.clone();

    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        let event = match res {
            Ok(e) => e,
            Err(e) => {
                eprintln!("[FitWatcher] Error: {:?}", e);
                return;
            }
        };

        if !matches!(
            event.kind,
            EventKind::Create(CreateKind::File) | EventKind::Create(CreateKind::Any)
        ) {
            return;
        }

        for p in &event.paths {
            let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("");
            if ext.eq_ignore_ascii_case("fit") {
                eprintln!("[FitWatcher] New .fit file: {:?}", p);
                let _ = app_handle.emit(
                    "fit-file-detected",
                    FitFileDetectedEvent {
                        sync_id: sid.clone(),
                        path: p.to_string_lossy().to_string(),
                    },
                );
            }
        }
    })
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    watcher
        .watch(&path_buf, RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;

    {
        let mut watchers = state.watchers.lock().map_err(|e| e.to_string())?;
        watchers.insert(sync_id.clone(), watcher);
    }

    eprintln!("[FitWatcher] Watching: {} (sync {})", path, sync_id);
    Ok(())
}

#[tauri::command]
pub fn stop_fit_watch(
    state: State<'_, FitWatcherState>,
    sync_id: String,
) -> Result<(), String> {
    stop_fit_watch_internal(&state, &sync_id);
    Ok(())
}

fn stop_fit_watch_internal(state: &State<'_, FitWatcherState>, sync_id: &str) {
    if let Ok(mut watchers) = state.watchers.lock() {
        if watchers.remove(sync_id).is_some() {
            eprintln!("[FitWatcher] Stopped watching sync {}", sync_id);
        }
    }
}

#[tauri::command]
pub fn stop_all_fit_watches(
    state: State<'_, FitWatcherState>,
) -> Result<(), String> {
    if let Ok(mut watchers) = state.watchers.lock() {
        let count = watchers.len();
        watchers.clear();
        eprintln!("[FitWatcher] Stopped {} watchers", count);
    }
    Ok(())
}
