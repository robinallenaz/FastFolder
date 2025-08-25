
const $ = (sel) => document.querySelector(sel);

const treeEl = $("#tree");
const saveBtn = $("#save");
const statusEl = $("#status");
let selected = null;

function renderFolder(node) {
  const details = document.createElement("details");
  details.open = true;
  const summary = document.createElement("summary");
  const radio = document.createElement("input");
  radio.type = "radio"; radio.name = "folderId"; radio.value = node.id;
  radio.addEventListener("change", () => {
    selected = { id: node.id, title: node.title || "Untitled folder" };
    saveBtn.disabled = false;
  });
  const name = document.createElement("span");
  name.className = "name"; name.textContent = node.title || "Untitled folder";
  summary.append(radio, name);
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

  const { folderId } = await chrome.storage.sync.get(["folderId"]);
  if (folderId) {
    const existing = treeEl.querySelector(`input[type=radio][value="${folderId}"]`);
    if (existing) {
      existing.checked = true;
      selected = { id: folderId, title: existing.parentElement.querySelector(".name").textContent };
      saveBtn.disabled = false;
    }
  }
}

async function save() {
  if (!selected) return;
  await chrome.storage.sync.set({ folderId: selected.id, folderTitle: selected.title });
  statusEl.textContent = "Saved";
  setTimeout(() => (statusEl.textContent = ""), 1500);
}

// Theme handling
const themeRadios = document.querySelectorAll("input[name=theme]");

async function loadTheme() {
  const { theme } = await chrome.storage.sync.get("theme");
  const choice = theme || "system";
  const radio = document.querySelector(`input[name=theme][value=${choice}]`);
  if (radio) radio.checked = true;
}

async function saveTheme() {
  const selected = document.querySelector("input[name=theme]:checked");
  if (!selected) return;
  await chrome.storage.sync.set({ theme: selected.value });
}

themeRadios.forEach(radio => radio.addEventListener("change", saveTheme));

document.addEventListener("DOMContentLoaded", () => {
  buildTree();
  saveBtn.addEventListener("click", save);
  loadTheme();
});
