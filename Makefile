.ONESHELL:
SHELL := /bin/bash
all: help

#############################################################################
# APP
run-dev: ## run the app in development mode (port 1421)
	export VITE_PORT=1421
	bun run tauri dev

build-debug: ## build the app in debug mode
	bun run tauri build --debug

build-release: ## build release binary
	bun run tauri build

build-macos: ## build the app for macOS (DMG and app bundle)
	@VERSION=$$(grep -m1 '^version = ' src-tauri/Cargo.toml | sed 's/version = "\(.*\)"/\1/'); \
	DMG="src-tauri/target/release/bundle/dmg/fit-sync_$${VERSION}_aarch64.dmg"; \
	if [ -f "$$DMG" ]; then \
		echo "macOS binary for version $$VERSION already exists:"; \
		ls -lh "$$DMG"; \
		read -p "Rebuild? [y/N] " -n 1 -r; \
		echo; \
		if [[ ! $$REPLY =~ ^[Yy]$$ ]]; then \
			echo "Skipping macOS build"; \
			exit 0; \
		fi; \
	fi; \
	bun run tauri build --bundles dmg,app

svelte-check: ## check all svelte errors
	bunx svelte-check

# Cross-platform sed -i (macOS requires '' arg, Linux doesn't)
# Usage: $(call sed-inplace,pattern,file)
define sed-inplace
	if [ "$$(uname)" = "Darwin" ]; then sed -i '' $(1) $(2); else sed -i $(1) $(2); fi
endef

version-patch: ## increment patch version (X.Y.Z -> X.Y.Z+1)
	@CURRENT_VERSION=$$(grep -m1 '^version = ' src-tauri/Cargo.toml | sed 's/version = "\(.*\)"/\1/'); \
	IFS='.' read -r MAJOR MINOR PATCH <<< "$$CURRENT_VERSION"; \
	NEW_PATCH=$$((PATCH + 1)); \
	NEW_VERSION="$$MAJOR.$$MINOR.$$NEW_PATCH"; \
	$(call sed-inplace,"s/^version = \".*\"/version = \"$$NEW_VERSION\"/",src-tauri/Cargo.toml); \
	$(call sed-inplace,"s/\"version\": \".*\"/\"version\": \"$$NEW_VERSION\"/",src-tauri/tauri.conf.json); \
	$(call sed-inplace,"s/\"version\": \".*\"/\"version\": \"$$NEW_VERSION\"/",package.json); \
	echo "Version bumped from $$CURRENT_VERSION to $$NEW_VERSION"; \
	cd src-tauri && cargo generate-lockfile && cd ..; \
	git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json package.json; \
	git commit -m "chore: bump $$NEW_VERSION"

#############################################################################
# RELEASE
release: build-macos ## create a release (build, collect artifacts, publish)
	@VERSION=$$(grep -m1 '^version = ' src-tauri/Cargo.toml | sed 's/version = "\(.*\)"/\1/'); \
	RELEASE_DIR="releases"; \
	mkdir -p $$RELEASE_DIR; \
	echo "Collecting artifacts for version $$VERSION..."; \
	if [ -f "src-tauri/target/release/bundle/dmg/fit-sync_$${VERSION}_aarch64.dmg" ]; then \
		cp src-tauri/target/release/bundle/dmg/fit-sync_$${VERSION}_aarch64.dmg \
		   $$RELEASE_DIR/macos-fit-sync_$${VERSION}_aarch64.dmg; \
		echo "  + macOS DMG"; \
	fi; \
	if ls $$RELEASE_DIR/windows-fit-sync_$${VERSION}* 1>/dev/null 2>&1; then \
		echo "  + Windows installer (already in releases/)"; \
	fi; \
	if ls $$RELEASE_DIR/linux-fit-sync_$${VERSION}* 1>/dev/null 2>&1; then \
		echo "  + Linux package (already in releases/)"; \
	fi; \
	echo ""; \
	echo "Files to publish:"; \
	ls -lh $$RELEASE_DIR/*$${VERSION}* 2>/dev/null; \
	echo ""; \
	read -p "Publish release v$$VERSION? [y/N] " -n 1 -r; \
	echo; \
	if [[ ! $$REPLY =~ ^[Yy]$$ ]]; then \
		echo "Release cancelled"; \
		exit 1; \
	fi; \
	echo "Publishing release v$$VERSION..."; \
	gh release create "v$$VERSION" $$RELEASE_DIR/*fit-sync_$${VERSION}* \
		--title "v$$VERSION" \
		--notes "" \
		--latest; \
	echo "Release v$$VERSION published!"; \
	$(MAKE) release-homebrew

release-homebrew: ## update homebrew cask with current version and sha256
	@VERSION=$$(grep -m1 '^version = ' src-tauri/Cargo.toml | sed 's/version = "\(.*\)"/\1/'); \
	DMG="releases/macos-fit-sync_$${VERSION}_aarch64.dmg"; \
	if [ ! -f "$$DMG" ]; then \
		echo "Error: DMG not found: $$DMG"; \
		exit 1; \
	fi; \
	SHA256=$$(shasum -a 256 "$$DMG" | awk '{print $$1}'); \
	CASK="/Users/dimfred/workspaces/homebrew-tap/Casks/fit-sync.rb"; \
	echo "Updating homebrew cask to $$VERSION (sha256: $$SHA256)"; \
	$(call sed-inplace,"s/^  version \".*\"/  version \"$$VERSION\"/",$$CASK); \
	$(call sed-inplace,"s/^  sha256 \".*\"/  sha256 \"$$SHA256\"/",$$CASK); \
	cd /Users/dimfred/workspaces/homebrew-tap && \
	git add Casks/fit-sync.rb && \
	git commit -m "fit-sync: bump to $$VERSION" && \
	git push; \
	echo "Homebrew cask updated!"

#############################################################################
# LINT
lint: ## run biome linter
	bunx biome check src/

lint-fix: ## run biome linter and fix issues
	bunx biome check --write src/

format: ## format code with biome
	bunx biome format --write src/

#############################################################################
# CLEAN
clean: ## clean the app
	rm -rf build
	cd src-tauri && cargo clean && cd ..
	rm -rf node_modules/.vite
	bun install

clean-dev: ## delete app files in dev
	@if [ "$$(uname)" = "Darwin" ]; then \
		rm -rf ~/Library/Application\ Support/com.fitsync.desktop; \
		rm -rf ~/Library/Caches/com.fitsync.desktop; \
		rm -rf ~/Library/WebKit/com.fitsync.desktop; \
	else \
		rm -rf ~/.config/com.fitsync.desktop/; \
		rm -rf ~/.local/share/com.fitsync.desktop/; \
		rm -rf ~/.cache/com.fitsync.desktop/; \
	fi
	@echo "Dev app files deleted"

#############################################################################
# HELP
help: ## print this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "\033[32m%-30s\033[0m %s\n", $$1, $$2}'
