# FIT Sync

Simple application to sync `.fit` files to your desired targets. Currently supports Garmin as a sink.

## Install

### Homebrew (macOS)

```sh
brew install --cask dimfred/tap/fit-sync
```

### From source

```sh
git clone https://github.com/Dimfred/fit-sync.git
cd fit-sync
bun install
make run-dev
```

Requires [Bun](https://bun.sh) and [Rust](https://rustup.rs).

## How it works

1. Click the tray icon to open the UI
2. Connect to Garmin via the Garmin icon (opens an OAuth login window)
3. Add a sync by clicking `+`, select a folder to watch and choose Garmin as the target
4. Drop `.fit` files into the watched folder — they get synced automatically

The app runs in the background as a menu bar agent. When a new `.fit` file appears in a watched folder, it uploads it to the configured target and sends a notification.

## Credits

The Garmin OAuth flow and API client are based on [garmin-connect](https://github.com/florianpasteur/garmin-connect) by Florian Pasteur. Thanks for figuring out the unofficial Garmin API and making it available!
