const API = "/api";
let currentPath = "/";
let searchMode = false;
let activeFilePath = null;
const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const response = await fetch(API + path, {
    headers: {"Content-Type": "application/json"},
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Something went wrong.");
  return data;
}
function showToast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => el.classList.remove("show"), 2800);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/(1024*1024)).toFixed(2)} MB`;
}
function parentPath(path) {
  if (path === "/") return "/";
  const p = path.split("/").filter(Boolean); p.pop();
  return p.length ? "/" + p.join("/") : "/";
}
function baseName(path) { return path.split("/").filter(Boolean).pop() || "root"; }

async function refresh() {
  try {
    const [tree, stats] = await Promise.all([api("/tree"), api("/stats")]);
    renderTree(tree);
    $("fileCount").textContent = stats.files;
    $("folderCount").textContent = stats.folders;
    $("storageUsed").textContent = formatBytes(stats.bytes);
    if (!searchMode) await loadDirectory(currentPath);
  } catch (e) { showToast(e.message); }
}
function renderTree(root) {
  const host = $("tree");
  function draw(node, path, depth) {
    const isFolder = node.type === "folder";
    let html = `<button class="${depth ? "indent " : ""}${isFolder ? "tree-folder" : ""}" data-path="${escapeHtml(path)}" data-type="${node.type}">${isFolder ? "▰" : "▤"} &nbsp; ${escapeHtml(node.name)}</button>`;
    if (isFolder) for (const child of node.children || []) {
      const childPath = path === "/" ? "/" + child.name : path + "/" + child.name;
      html += draw(child, childPath, depth+1);
    }
    return html;
  }
  host.innerHTML = draw(root, "/", 0);
  host.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => {
    if (btn.dataset.type === "folder") { searchMode = false; $("searchInput").value = ""; loadDirectory(btn.dataset.path); }
    else openEditor(btn.dataset.path);
  }));
}
async function loadDirectory(path) {
  try {
    currentPath = path; searchMode = false;
    const data = await api("/items?path=" + encodeURIComponent(path));
    $("breadcrumb").textContent = path;
    $("listTitle").textContent = path === "/" ? "Root directory" : baseName(path);
    $("itemSubtitle").textContent = "Files and folders in this location";
    $("searchInfo").textContent = "";
    renderRows(data.items);
  } catch(e) { showToast(e.message); }
}
function renderRows(items) {
  const body = $("fileRows");
  $("itemCount").textContent = `${items.length} item${items.length === 1 ? "" : "s"}`;
  $("emptyState").classList.toggle("hidden", items.length !== 0);
  body.innerHTML = items.map(item => {
    const folder = item.type === "folder";
    return `<tr>
      <td><div class="name-cell"><span class="file-icon ${folder ? "" : "file"}">${folder ? "▰" : "▤"}</span>
      <button class="name-button" data-open="${escapeHtml(item.path)}" data-type="${item.type}">${escapeHtml(item.name)}</button></div></td>
      <td><span class="type-pill">${folder ? "Folder" : "File"}</span></td>
      <td>${folder ? "—" : formatBytes(item.size || 0)}</td>
      <td><div class="row-actions"><button class="small-action" data-rename="${escapeHtml(item.path)}">Rename</button>${folder ? "" : `<button class="small-action" data-edit="${escapeHtml(item.path)}">Edit</button>`}<button class="small-action danger" data-delete="${escapeHtml(item.path)}">Delete</button></div></td>
    </tr>`;
  }).join("");
  body.querySelectorAll("[data-open]").forEach(btn => btn.addEventListener("click", () => {
    if (btn.dataset.type === "folder") loadDirectory(btn.dataset.open); else openEditor(btn.dataset.open);
  }));
  body.querySelectorAll("[data-rename]").forEach(btn => btn.addEventListener("click", () => renameItem(btn.dataset.rename)));
  body.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => openEditor(btn.dataset.edit)));
  body.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => deleteItem(btn.dataset.delete)));
}
async function runSearch(query) {
  if (!query.trim()) { searchMode = false; await loadDirectory(currentPath); return; }
  searchMode = true;
  try {
    const data = await api("/search?q=" + encodeURIComponent(query));
    $("breadcrumb").textContent = "Search results";
    $("listTitle").textContent = "Search results";
    $("itemSubtitle").textContent = `Matches for “${query}”`;
    $("searchInfo").textContent = `${data.results.length} result(s) found`;
    renderRows(data.results);
  } catch(e) { showToast(e.message); }
}
function openCreate(kind) {
  $("itemForm").dataset.kind = kind;
  $("dialogTitle").textContent = kind === "folder" ? "Create new folder" : "Create new file";
  $("itemForm").querySelector('[type="submit"]').textContent = "Create";
  $("itemName").value = "";
  $("itemContent").value = "";
  $("contentFieldWrap").classList.toggle("hidden", kind === "folder");
  $("dialogHint").textContent = `This ${kind} will be created inside ${currentPath}.`;
  $("itemDialog").showModal(); $("itemName").focus();
}
$("itemForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const kind = e.currentTarget.dataset.kind;
    const result = await api("/create", {method:"POST", body:JSON.stringify({
      parent: currentPath, name: $("itemName").value, kind, content: $("itemContent").value
    })});
    $("itemDialog").close(); showToast(result.message); await refresh();
  } catch(err) { showToast(err.message); }
});
async function renameItem(path) {
  const newName = prompt("Enter the new name:", baseName(path));
  if (newName === null || !newName.trim()) return;
  try {
    const result = await api("/rename", {method:"POST", body:JSON.stringify({path, new_name:newName})});
    showToast(result.message); await refresh();
  } catch(e) { showToast(e.message); }
}
async function deleteItem(path) {
  if (!confirm(`Delete "${baseName(path)}"? This cannot be undone in this simulator.`)) return;
  try {
    const result = await api("/item?path=" + encodeURIComponent(path), {method:"DELETE"});
    showToast(result.message);
    if (currentPath === path || currentPath.startsWith(path + "/")) currentPath = parentPath(path);
    await refresh();
  } catch(e) { showToast(e.message); }
}
async function openEditor(path) {
  try {
    const data = await api("/file?path=" + encodeURIComponent(path));
    activeFilePath = path;
    $("editorTitle").textContent = data.name;
    $("editorContent").value = data.content;
    $("editorDialog").showModal();
  } catch(e) { showToast(e.message); }
}
$("editorForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const result = await api("/file", {method:"PUT", body:JSON.stringify({path:activeFilePath, content:$("editorContent").value})});
    $("editorDialog").close(); showToast(result.message); await refresh();
  } catch(e) { showToast(e.message); }
});
$("newFolderBtn").addEventListener("click", () => openCreate("folder"));
$("newFileBtn").addEventListener("click", () => openCreate("file"));
$("refreshBtn").addEventListener("click", refresh);
$("rootBtn").addEventListener("click", () => { $("searchInput").value = ""; loadDirectory("/"); });
$("homeBtn").addEventListener("click", () => { $("searchInput").value = ""; loadDirectory("/"); });
$("searchInput").addEventListener("input", e => {
  clearTimeout(window.searchTimer);
  window.searchTimer = setTimeout(() => runSearch(e.target.value), 250);
});
["closeDialog","cancelDialog"].forEach(id => $(id).addEventListener("click", () => $("itemDialog").close()));
["closeEditor","cancelEditor"].forEach(id => $(id).addEventListener("click", () => $("editorDialog").close()));
refresh();
