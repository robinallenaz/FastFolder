// Utility function for DOM selection
const $ = (sel) => document.querySelector(sel);

// UI element references
const treeEl = $("#tree");           // Container for bookmark folder tree
const saveBtn = $("#save");           // Save button
const statusEl = $("#status");        // Status message element
let selectedFolders = [];              // Array of selected folder objects

/**
 * Recursively renders a folder node and its children as checkboxes.
 * @param {Object} node - The bookmark folder node.
 * @returns {HTMLElement} The DOM element for this folder.
 */
function renderFolder(node) {
  const details = document.createElement("details");
  details.open = true;
  const summary = document.createElement("summary");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox"; checkbox.name = "folderIds"; checkbox.value = node.id;
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      selectedFolders.push({ id: node.id, title: node.title || "Untitled folder" });
    } else {
      selectedFolders = selectedFolders.filter(f => f.id !== node.id);
    }
    saveBtn.disabled = selectedFolders.length === 0;
  });
  const name = document.createElement("span");
  name.className = "name"; name.textContent = node.title || "Untitled folder";
  summary.append(checkbox, name);
  details.appendChild(summary);

  if (node.children) {
    for (const child of node.children) {
      if (child.url) continue;
      const childWrap = document.createElement("div");
      childWrap.className = "folder";
      childWrap.appendChild(renderFolder(child));
      details.appendChild(childWrap);
    }
  }
  return details;
}

/**
 * Builds the folder tree UI and restores previously selected folders.
 */
async function buildTree() {
  const roots = await chrome.bookmarks.getTree();
  const root = roots && roots[0];
  treeEl.innerHTML = "";
  function addIfFolder(n, container) {
    if (!n) return;
    if (n.children) {
      const wrap = document.createElement("div");
      wrap.className = "folder";
      wrap.appendChild(renderFolder(n));
      container.appendChild(wrap);
    }
  }
  for (const child of root.children || []) addIfFolder(child, treeEl);

  // Restore previously selected folders from storage
  const { folders } = await chrome.storage.sync.get(["folders"]);
  selectedFolders = Array.isArray(folders) ? folders : [];
  selectedFolders.forEach(f => {
    const existing = treeEl.querySelector(`input[type=checkbox][value="${f.id}"]`);
    if (existing) {
      existing.checked = true;
    }
  });
  saveBtn.disabled = selectedFolders.length === 0;
}

/**
 * Saves the selected folders to Chrome storage.
 */
async function save() {
  if (!selectedFolders.length) return;
  await chrome.storage.sync.set({ folders: selectedFolders });
  statusEl.textContent = "Saved";
  setTimeout(() => (statusEl.textContent = ""), 1500);
}

// Theme handling
const themeRadios = document.querySelectorAll("input[name=theme]");

/**
 * Loads the saved theme from Chrome storage and applies it.
 */
async function loadTheme() {
  const { theme } = await chrome.storage.sync.get("theme");
  const choice = theme || "system";
  const radio = document.querySelector(`input[name=theme][value=${choice}]`);
  if (radio) radio.checked = true;
}

/**
 * Saves the selected theme to Chrome storage.
 */
async function saveTheme() {
  const selected = document.querySelector("input[name=theme]:checked");
  if (!selected) return;
  await chrome.storage.sync.set({ theme: selected.value });
}

themeRadios.forEach(radio => radio.addEventListener("change", saveTheme));

// Initialize the UI and event listeners on page load
document.addEventListener("DOMContentLoaded", () => {
  buildTree();
  saveBtn.addEventListener("click", save);
  loadTheme();
});
