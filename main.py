from pathlib import PurePosixPath
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import json
from pathlib import Path

APP_DIR = Path(__file__).parent
DATA_FILE = APP_DIR / "filesystem.json"

app = FastAPI(title="File System Management Simulator", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"]
)
app.mount("/static", StaticFiles(directory=APP_DIR / "static"), name="static")

def default_fs():
    return {
        "name": "root", "type": "folder", "children": [
            {"name": "Documents", "type": "folder", "children": [
                {"name": "welcome.txt", "type": "file", "content": "Welcome to the File System Management Simulator."}
            ]},
            {"name": "Pictures", "type": "folder", "children": []},
            {"name": "readme.txt", "type": "file", "content": "This is a simulated file system. Your computer files are not changed."}
        ]
    }

def load_fs():
    if DATA_FILE.exists():
        try:
            return json.loads(DATA_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    data = default_fs()
    save_fs(data)
    return data

def save_fs(data):
    DATA_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")

fs = load_fs()

class CreateItem(BaseModel):
    parent: str = "/"
    name: str = Field(min_length=1, max_length=100)
    kind: str
    content: str = ""

class RenameItem(BaseModel):
    path: str
    new_name: str = Field(min_length=1, max_length=100)

class ContentItem(BaseModel):
    path: str
    content: str

class PathItem(BaseModel):
    path: str

def clean_path(path: str) -> str:
    path = "/" + path.strip().strip("/")
    if path == "/":
        return "/"
    parts = PurePosixPath(path).parts
    if any(part in (".", "..") for part in parts):
        raise HTTPException(400, "Invalid path.")
    return "/" + "/".join(parts[1:])

def find_node(path: str):
    path = clean_path(path)
    node = fs
    if path == "/":
        return node, None, None
    parts = path.strip("/").split("/")
    parent = None
    for part in parts:
        if node.get("type") != "folder":
            raise HTTPException(400, "A file cannot contain another item.")
        parent = node
        found = next((x for x in node.get("children", []) if x["name"] == part), None)
        if found is None:
            raise HTTPException(404, f"Path not found: {path}")
        node = found
    return node, parent, parts[-1]

def serialize(node, path="/"):
    item = {"name": node["name"], "type": node["type"], "path": path}
    if node["type"] == "folder":
        item["children"] = [
            serialize(child, (path.rstrip("/") + "/" + child["name"]) if path != "/" else "/" + child["name"])
            for child in node.get("children", [])
        ]
    else:
        item["size"] = len(node.get("content", "").encode("utf-8"))
    return item

def all_items(node=None, path="/"):
    node = fs if node is None else node
    result = []
    for child in node.get("children", []):
        child_path = (path.rstrip("/") + "/" + child["name"]) if path != "/" else "/" + child["name"]
        result.append({"name": child["name"], "type": child["type"], "path": child_path,
                       "size": len(child.get("content", "").encode("utf-8")) if child["type"] == "file" else 0})
        if child["type"] == "folder":
            result.extend(all_items(child, child_path))
    return result

@app.get("/", response_class=HTMLResponse)
def home():
    return (APP_DIR / "static" / "index.html").read_text(encoding="utf-8")

@app.get("/api/tree")
def get_tree():
    return serialize(fs)

@app.get("/api/items")
def get_items(path: str = "/"):
    node, _, _ = find_node(path)
    if node["type"] != "folder":
        raise HTTPException(400, "Selected path is not a folder.")
    return {"path": clean_path(path), "items": [
        {"name": c["name"], "type": c["type"],
         "path": (clean_path(path).rstrip("/") + "/" + c["name"]) if clean_path(path) != "/" else "/" + c["name"],
         "size": len(c.get("content", "").encode("utf-8")) if c["type"] == "file" else 0}
        for c in node.get("children", [])
    ]}

@app.post("/api/create")
def create_item(item: CreateItem):
    name = item.name.strip()
    if name in ("", ".", "..") or "/" in name or "\\" in name:
        raise HTTPException(400, "Enter a valid name without slashes.")
    if item.kind not in ("file", "folder"):
        raise HTTPException(400, "Kind must be file or folder.")
    parent, _, _ = find_node(item.parent)
    if parent["type"] != "folder":
        raise HTTPException(400, "Parent must be a folder.")
    if any(c["name"].casefold() == name.casefold() for c in parent.get("children", [])):
        raise HTTPException(409, "An item with that name already exists in this folder.")
    child = {"name": name, "type": item.kind}
    if item.kind == "folder":
        child["children"] = []
    else:
        child["content"] = item.content
    parent.setdefault("children", []).append(child)
    save_fs(fs)
    return {"message": f"{item.kind.title()} created successfully.", "tree": serialize(fs)}

@app.post("/api/rename")
def rename_item(item: RenameItem):
    node, parent, _ = find_node(item.path)
    if parent is None:
        raise HTTPException(400, "The root folder cannot be renamed.")
    new_name = item.new_name.strip()
    if new_name in ("", ".", "..") or "/" in new_name or "\\" in new_name:
        raise HTTPException(400, "Enter a valid name without slashes.")
    if any(c is not node and c["name"].casefold() == new_name.casefold() for c in parent.get("children", [])):
        raise HTTPException(409, "An item with that name already exists.")
    old = node["name"]
    node["name"] = new_name
    save_fs(fs)
    return {"message": f"Renamed '{old}' to '{new_name}'.", "tree": serialize(fs)}

@app.get("/api/file")
def read_file(path: str):
    node, _, _ = find_node(path)
    if node["type"] != "file":
        raise HTTPException(400, "Selected item is a folder.")
    return {"path": clean_path(path), "name": node["name"], "content": node.get("content", "")}

@app.put("/api/file")
def update_file(item: ContentItem):
    node, _, _ = find_node(item.path)
    if node["type"] != "file":
        raise HTTPException(400, "Selected item is a folder.")
    node["content"] = item.content
    save_fs(fs)
    return {"message": "File saved successfully.", "size": len(item.content.encode("utf-8"))}

@app.delete("/api/item")
def delete_item(path: str):
    node, parent, _ = find_node(path)
    if parent is None:
        raise HTTPException(400, "The root folder cannot be deleted.")
    parent["children"].remove(node)
    save_fs(fs)
    return {"message": f"Deleted '{node['name']}'.", "tree": serialize(fs)}

@app.get("/api/search")
def search_items(q: str):
    query = q.strip().casefold()
    if not query:
        return {"results": []}
    results = [item for item in all_items() if query in item["name"].casefold() or query in item["path"].casefold()]
    return {"results": results}

@app.get("/api/stats")
def stats():
    items = all_items()
    files_list = [x for x in items if x["type"] == "file"]
    folders_list = [x for x in items if x["type"] == "folder"]
    total_bytes = sum(x["size"] for x in files_list)
    return {"files": len(files_list), "folders": len(folders_list), "bytes": total_bytes,
            "used_kb": round(total_bytes / 1024, 2), "total_items": len(items)}
