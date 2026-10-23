# File System Management Simulator

A student-friendly Operating Systems mini project built with Python, FastAPI, HTML, CSS and JavaScript.

## Features
- Create folders and text files
- Rename and delete items
- Open and edit text files
- Search files and folders by name or path
- Browse a directory tree
- View file count, folder count and storage usage
- Save simulated filesystem state to `filesystem.json`

## Important
This project operates on a **simulated filesystem** stored in this project folder. It does not manage or delete your real computer files.

## Requirements
- Python 3.10+
- Internet connection only if your browser needs to load Google Fonts; the project itself does not need an external API.

## Setup and run

### 1. Open the project folder in a terminal
```bash
cd file_system_management_simulator
```

### 2. Create and activate a virtual environment (recommended)
Windows:
```bash
python -m venv .venv
.venv\\Scripts\\activate
```

macOS/Linux:
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install packages
```bash
pip install -r requirements.txt
```

### 4. Start the server
```bash
uvicorn main:app --reload
```

### 5. Open in your browser
- App: http://127.0.0.1:8000
- Interactive API docs: http://127.0.0.1:8000/docs

## API endpoints
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/tree` | Get the complete directory tree |
| GET | `/api/items?path=/` | List items in a folder |
| POST | `/api/create` | Create a file or folder |
| POST | `/api/rename` | Rename an item |
| GET | `/api/file?path=/readme.txt` | Read a text file |
| PUT | `/api/file` | Save text file content |
| DELETE | `/api/item?path=/readme.txt` | Delete an item |
| GET | `/api/search?q=readme` | Search items |
| GET | `/api/stats` | Get storage statistics |

## Operating System concepts demonstrated
- File and directory organization
- Hierarchical directory tree
- File operations: create, read, update, delete (CRUD)
- File metadata and storage accounting
- Path validation and error handling

## Suggested demo
1. Create a folder named `College`.
2. Open it and create `os_notes.txt`.
3. Add a few lines and save the file.
4. Rename the file to `unit1_notes.txt`.
5. Search for `unit1`.
6. Delete the file and observe the directory list.
7. Explain how a hierarchical directory structure is represented as a tree.

## Suggested abstract
The File System Management Simulator is a web-based educational application that demonstrates fundamental file system operations in an operating system. The frontend is developed using HTML, CSS and JavaScript, while Python FastAPI provides REST APIs for creating, viewing, editing, renaming, deleting and searching simulated files and folders. The application displays a hierarchical directory tree and basic storage statistics. Data is stored in a JSON file so the simulated file system persists after restarting the server. The project provides a safe, interactive way for students to understand directory structures, file metadata, path handling and CRUD operations.

## Limitations / future scope
- Current version supports text files in a simulated filesystem.
- It is intended for local academic demonstrations, not production or multi-user use.
- Future improvements can include login, access permissions, file upload/download, recycle bin, and database storage.
