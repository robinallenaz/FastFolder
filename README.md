# FastFolder

FastFolder is a browser extension that lets you instantly access one or more chosen bookmarks folders from a pinned toolbar icon.

## Features
- Quick access to any of your selected bookmark folders via popup
- Switch between multiple folders using a dropdown in the popup
- Search and filter bookmarks by title or URL
- Open bookmarks in foreground or background tab (Ctrl/Cmd-click)
- Change your selected folders at any time via the options page
- Light, dark, and system theme support

## Usage
1. Install the extension in your browser
2. Click the FastFolder icon in your toolbar
3. If no folder is set, use the options page to pick one or more bookmarks folders
4. Use the dropdown to switch between folders in the popup
5. Click bookmarks to open them
6. Use the search box to filter bookmarks

## Permissions
- **Bookmarks**: To read your bookmarks
- **Storage**: To save your folders and theme preferences
- **Tabs**: To open bookmarks in new tabs

## Pinning the Extension
- In Chrome/Edge: Click the puzzle icon in the toolbar → pin FastFolder
- In Firefox: Right-click the toolbar → Customize Toolbar… → drag the icon in

## Install for Development / Testing(Chrome/Edge)
1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable Developer mode.
3. Click "Load unpacked" and select the FastFolder folder.
4. Pin the FastFolder icon in the toolbar.

## Browser Support
- Built and tested for Chromium browsers (Chrome, Edge) using Manifest V3.
- Firefox: MV3 service worker support is still evolving; this project currently targets Chromium.