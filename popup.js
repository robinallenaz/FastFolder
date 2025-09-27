// UI element references
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

// Global state for folders, current folder, and bookmark items
let state = { folders: [], folderId: null, folderTitle: null, items: [] };

// Fetch the array of selected folders from storage
/**
 * Retrieves the stored folders from Chrome storage.
 * @returns {Promise<Array>} An array of folder objects.
 */
async function getStoredFolders() {
  const { folders } = await chrome.storage.sync.get(["folders"]);
  return Array.isArray(folders) ? folders : [];
}

// Get favicon URL for a bookmark
/**
 * Returns the favicon URL for a given bookmark URL.
 * @param {string} url The URL of the bookmark.
 * @returns {string} The favicon URL.
 */
function faviconFor(url) {
  try {
    const u = new URL(url);
    // Try browser favicon service first
    if (typeof chrome !== "undefined" && chrome.runtime.getURL) {
      return `chrome://favicon/size/16@2x/${url}`;
    }
    // Fallback to Google S2 favicon service
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  } catch {
    return "";
  }
}

// Render the list of bookmarks for the current folder
/**
 * Renders the list of bookmarks for the current folder.
 * @param {Array} items The list of bookmark items.
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
      // Open bookmark in new tab; Ctrl/Cmd-click opens in background
      li.addEventListener("click", (e) => {
        const bg = e.metaKey || e.ctrlKey;
        chrome.tabs.create({ url: it.url, active: !bg });
        window.close();
      });
      UI.list.appendChild(li);
    }
  }
}

// Filter bookmarks based on search input
/**
 * Filters the bookmarks based on the search input.
 */
function applyFilter() {
  const q = UI.search.value.trim().toLowerCase();
  if (!q) { renderList(state.items); return; }
  const filtered = state.items.filter(
    (it) => (it.title && it.title.toLowerCase().includes(q)) || it.url.toLowerCase().includes(q)
  );
  renderList(filtered);
}

// Recursively collect all bookmarks from a folder node
/**
 * Recursively collects all bookmarks from a folder node.
 * @param {Array} nodes The folder nodes.
 * @param {Array} out The output array of bookmarks.
 */
function collectBookmarks(nodes, out) {
  for (const n of nodes) {
    if (n.url) { out.push({ title: n.title, url: n.url }); }
    else if (n.children && n.children.length) { collectBookmarks(n.children, out); }
  }
}

// Load and display bookmarks for a given folder ID
/**
 * Loads and displays the bookmarks for a given folder ID.
 * @param {string} folderId The ID of the folder.
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

// Populate the folder dropdown with all selected folders
/**
 * Populates the folder dropdown with all selected folders.
 * @param {Array} folders The array of folder objects.
 * @param {string} activeId The ID of the active folder.
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

// Apply the selected theme to the popup
/**
 * Applies the selected theme to the popup.
 */
async function applyTheme() {
  const { theme } = await chrome.storage.sync.get("theme");
  document.body.classList.remove("dark", "light");
  if (theme === "dark") document.body.classList.add("dark");
  else if (theme === "light") document.body.classList.add("light");
}

// Initialize the popup: load folders, set up UI, and event listeners
/**
 * Initializes the popup: loads folders, sets up UI, and event listeners.
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
  // Live search
  UI.search.addEventListener("input", applyFilter);
  // React to storage changes (folders or theme)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.theme) applyTheme();
    if (area === "sync" && changes.folders) {
      state.folders = changes.folders.newValue || [];
      populateFolderDropdown(state.folders, state.folderId);
    }
  });
  // Open all visible bookmarks in background
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
}

// Start initialization when popup loads
// (DOMContentLoaded ensures DOM is ready)
document.addEventListener("DOMContentLoaded", init);
