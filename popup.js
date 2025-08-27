const $ = (sel) => document.querySelector(sel);

const UI = {
  list: $("#list"),
  empty: $("#empty"),
  chooseFirst: $("#chooseFirst"),
  folderName: $("#folderName"),
  changeFolder: $("#changeFolder"),
  search: $("#search"),
  refresh: $("#refresh"),
  openOptions: $("#openOptions")
};

let state = { folderId: null, folderTitle: null, items: [] };

async function getStoredFolder() {
  const { folderId, folderTitle } = await chrome.storage.sync.get(["folderId", "folderTitle"]);
  return { folderId, folderTitle };
}

function faviconFor(url) {
  try {
    const u = new URL(url);
    if (typeof chrome !== "undefined" && chrome.runtime.getURL) {
      return `chrome://favicon/size/16@2x/${url}`;
    }
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  } catch {
    return "";
  }
}

function renderList(items) {
  UI.list.innerHTML = "";
  if (!items.length) {
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
      li.addEventListener("click", (e) => {
        const bg = e.metaKey || e.ctrlKey;
        chrome.tabs.create({ url: it.url, active: !bg });
        window.close();
      });
      UI.list.appendChild(li);
    }
  }
}

function applyFilter() {
  const q = UI.search.value.trim().toLowerCase();
  if (!q) { renderList(state.items); return; }
  const filtered = state.items.filter(
    (it) => (it.title && it.title.toLowerCase().includes(q)) || it.url.toLowerCase().includes(q)
  );
  renderList(filtered);
}

function collectBookmarks(nodes, out) {
  for (const n of nodes) {
    if (n.url) { out.push({ title: n.title, url: n.url }); }
    else if (n.children && n.children.length) { collectBookmarks(n.children, out); }
  }
}

async function loadFolder(folderId) {
  try {
    const sub = await chrome.bookmarks.getSubTree(folderId);
    const root = sub && sub[0];
    if (!root) throw new Error("Folder not found");
    state.folderTitle = root.title || state.folderTitle || "Selected folder";
    UI.folderName.textContent = state.folderTitle;
    const items = [];
    collectBookmarks(root.children || [], items);
    state.items = items;
    applyFilter();
  } catch (e) {
    UI.empty.textContent = "Folder not found. Choose another.";
    UI.empty.classList.remove("hidden");
  }
}

async function applyTheme() {
  const { theme } = await chrome.storage.sync.get("theme");
  document.body.classList.remove("dark", "light");
  if (theme === "dark") document.body.classList.add("dark");
  else if (theme === "light") document.body.classList.add("light");
}

async function init() {
  await applyTheme();
  const stored = await getStoredFolder();
  state.folderId = stored.folderId || null;
  state.folderTitle = stored.folderTitle || null;

  if (!state.folderId) {
    UI.chooseFirst.classList.remove("hidden");
    UI.folderName.textContent = "Not set";
  } else {
    UI.chooseFirst.classList.add("hidden");
    UI.folderName.textContent = state.folderTitle || "(loading…)";
    await loadFolder(state.folderId);
  }

  UI.changeFolder.addEventListener("click", () => chrome.runtime.openOptionsPage());
  UI.openOptions?.addEventListener("click", () => chrome.runtime.openOptionsPage());
  UI.refresh.addEventListener("click", async () => { if (state.folderId) await loadFolder(state.folderId); });
  UI.search.addEventListener("input", applyFilter);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.theme) applyTheme();
    if (area === "sync" && changes.folderId) {
      state.folderId = changes.folderId.newValue;
      state.folderTitle = (changes.folderTitle && changes.folderTitle.newValue) || state.folderTitle;
      if (state.folderId) { UI.chooseFirst.classList.add("hidden"); loadFolder(state.folderId); }
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
