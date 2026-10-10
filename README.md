# Classroom Register: Student Management System

Classroom Register is a small student register for **Assessment Aim 3**. It keeps the class list, search and a few useful mark summaries together on one screen, so everyday record updates are easy to find.

The frontend uses HTML, CSS and JavaScript. Flask handles the API, and SQLite keeps records between runs.

## Features

- Add, search, edit and delete student records without reloading the page.
- Search by student name, roll number or class.
- Validate required fields, marks from 0 to 100, contact number format and unique roll numbers in the browser and on the server.
- Show total students, average marks and the highest score.
- Keep data in `students.db`, created automatically on first launch.
- Handle duplicate roll numbers and missing records with clear API errors.

## Design note

The page is intentionally centered on one class list rather than several dashboard screens. The register starts empty, so use the **Add student** button to enter your own class details. Before submission, adjust the class examples or labels to match the format used in your course.

## Requirements

- Python 3.10 or newer
- Node.js is optional and used only for the frontend syntax-check script.

## Run

Open a terminal in this folder and run:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

Open <http://127.0.0.1:5000> in a browser. Stop the server with `Ctrl+C`.

If PowerShell blocks environment activation, run the venv's Python directly:

```powershell
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe app.py
```

Optional frontend check, when Node.js is installed:

```powershell
npm run check:frontend
```

## REST API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/students` | List students |
| `GET` | `/api/students?q=maya` | Search name, roll number or class |
| `POST` | `/api/students` | Add a student |
| `PUT` | `/api/students/<id>` | Update a student |
| `DELETE` | `/api/students/<id>` | Delete a student |

Student JSON fields: `name`, `roll_no`, `class_name`, `marks`, and `contact`.

## Run tests

```powershell
python -m unittest discover -s tests -v
```