// UI element references used throughout the popup UI
const UI = {
  list: $("#list"),          // Bookmark list container
  empty: $("#empty"),        // Message for empty or not found folders
  chooseFirst: $("#chooseFirst"), // Prompt to pick folders if none selected
  folderDropdown: $("#folderDropdown"), // Dropdown for switching folders
  changeFolder: $("#changeFolder"),    // Button to open options page
  search: $("#search"),      // Search input box
  refresh: $("#refresh"),    // Refresh button
  openOptions: $("#openOptions"), // Button to open options from prompt
  openAll: $("#openAll") // Open all visible bookmarks
};

// Global state for user-selected folders, the active folder, and its bookmark items
let state = { folders: [], folderId: null, folderTitle: null, items: [] };

/**
 * Reads the user's selected bookmark folders from Chrome sync storage.
 * @returns {Promise<Array<{id: string, title: string}>>} Array of saved folder metadata.
 */
async function getStoredFolders() {
  const { folders } = await chrome.storage.sync.get(["folders"]);
  return Array.isArray(folders) ? folders : [];
}

/**
 * Produces a favicon image URL for the given bookmark URL.
 * Prefers the browser's built-in favicon service; falls back to Google S2.
 * @param {string} url - The bookmark's target URL.
 * @returns {string} A favicon URL or empty string on failure.
 */
function faviconFor(url) {
  try {
    const u = new URL(url);
    // Prefer chrome://favicon; if it fails, fall back to Google S2
    return `chrome://favicon/size/16@2x/${url}`;
  } catch {
    return "";
  }
}

/**
 * Render the provided bookmark items into the list.
 * Clears any previous content and shows an empty state if there are no items.
 * @param {Array<{title?: string, url: string}>} items
 */
function renderList(items) {
  UI.list.innerHTML = "";
  if (!items.length) {
    UI.empty.textContent = "This folder has no bookmarks.";
    UI.empty.classList.remove("hidden");
  } else {
    UI.empty.classList.add("hidden");
    for (const it of items) {
      const li = document.createElement("li");
      li.dataset.url = it.url;
      const img = document.createElement("img");
      img.className = "fav";
      img.alt = "";
      // Try chrome://favicon first, but fallback to Google S2 if it fails
      img.src = faviconFor(it.url);
      img.onerror = function() {
        try {
          const u = new URL(it.url);
          img.src = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
        } catch {
          img.src = "";
        }
      };
      const title = document.createElement("div");
      title.className = "title";
      title.textContent = it.title || it.url;
      const url = document.createElement("div");
      url.className = "url";
      url.textContent = it.url;
      li.append(img, title, url);
      // Open the bookmark; hold Ctrl/Cmd to open in background
      li.addEventListener("click", (e) => {
        const bg = e.metaKey || e.ctrlKey;
        chrome.tabs.create({ url: it.url, active: !bg });
        window.close();
      });
      UI.list.appendChild(li);
    }
  }
}

/**
 * Filter the in-memory list using the search box value (case-insensitive)
 * against bookmark title and URL, then re-render the list.
 */
function applyFilter() {
  const q = UI.search.value.trim().toLowerCase();
  if (!q) { renderList(state.items); return; }
  const filtered = state.items.filter(
    (it) => (it.title && it.title.toLowerCase().includes(q)) || it.url.toLowerCase().includes(q)
  );
  renderList(filtered);
}

/**
 * Depth-first traversal to collect bookmark leaf nodes from a folder subtree.
 * @param {Array} nodes - Children to traverse.
 * @param {Array<{title?: string, url: string}>} out - Collector array.
 */
function collectBookmarks(nodes, out) {
  for (const n of nodes) {
    if (n.url) { out.push({ title: n.title, url: n.url }); }
    else if (n.children && n.children.length) { collectBookmarks(n.children, out); }
  }
}

/**
 * Load the bookmarks for a specific folder ID and render them.
 * Updates in-memory state and handles the "folder not found" case.
 * @param {string} folderId
 */
async function loadFolder(folderId) {
  try {
    const sub = await chrome.bookmarks.getSubTree(folderId);
    const root = sub && sub[0];
    if (!root) throw new Error("Folder not found");
    state.folderTitle = root.title || state.folderTitle || "Selected folder";
    const items = [];
    collectBookmarks(root.children || [], items);
    state.items = items;
    applyFilter();
  } catch (e) {
    UI.empty.textContent = "Folder not found. It may have been moved or deleted. Please choose another.";
    UI.empty.classList.remove("hidden");
  }
}

/**
 * Populate the folder dropdown with all saved folders and select the active one.
 * @param {Array<{id: string, title: string}>} folders
 * @param {string} activeId
 */
function populateFolderDropdown(folders, activeId) {
  UI.folderDropdown.innerHTML = "";
  folders.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.title;
    if (f.id === activeId) opt.selected = true;
    UI.folderDropdown.appendChild(opt);
  });
}

/**
 * Apply the persisted theme preference to the popup document (light/dark/system).
 */
async function applyTheme() {
  const { theme } = await chrome.storage.sync.get("theme");
  document.body.classList.remove("dark", "light");
  if (theme === "dark") document.body.classList.add("dark");
  else if (theme === "light") document.body.classList.add("light");
}

/**
 * Initialize the popup: theme, folders, default selection, event wiring.
 * - Applies theme
 * - Loads saved folders (and last-used folder if available)
 * - Renders current folder
 * - Sets up handlers (dropdown change, options, refresh, search, storage, open-all)
 */
async function init() {
  await applyTheme();
  state.folders = await getStoredFolders();
  if (!state.folders.length) {
    UI.chooseFirst.classList.remove("hidden");
    UI.folderDropdown.innerHTML = "";
    return;
  }
  const { lastFolderId } = await chrome.storage.local.get(["lastFolderId"]);
  const startId = (lastFolderId && state.folders.some(f => f.id === lastFolderId)) ? lastFolderId : state.folders[0].id;
  populateFolderDropdown(state.folders, startId);
  state.folderId = startId;
  await loadFolder(state.folderId);
  // Handle folder switching
  UI.folderDropdown.addEventListener("change", async (e) => {
    state.folderId = e.target.value;
    await loadFolder(state.folderId);
    chrome.storage.local.set({ lastFolderId: state.folderId });
  });
  // Open options page handlers
  UI.changeFolder.addEventListener("click", () => chrome.runtime.openOptionsPage());
  UI.openOptions?.addEventListener("click", () => chrome.runtime.openOptionsPage());
  // Refresh current folder
  UI.refresh.addEventListener("click", async () => { if (state.folderId) await loadFolder(state.folderId); });
  // Live search (case-insensitive on title and URL)
  UI.search.addEventListener("input", applyFilter);
  // Open all visible bookmarks in background (asks for confirmation if > 10)
  UI.openAll?.addEventListener("click", () => {
    const items = Array.from(UI.list.querySelectorAll("li"));
    if (!items.length) return;
    if (items.length > 10 && !confirm(`Open all ${items.length} bookmarks?`)) return;
    for (const li of items) {
      const url = li.dataset.url;
      if (url) chrome.tabs.create({ url, active: false });
    }
    window.close();
  });
  // React to storage changes (folders or theme)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.theme) applyTheme();
    if (area === "sync" && changes.folders) {
      state.folders = changes.folders.newValue || [];
      populateFolderDropdown(state.folders, state.folderId);
    }
  });
}

// Bootstrap once DOM is ready
document.addEventListener("DOMContentLoaded", init);
