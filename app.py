import re
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from flask import Flask, jsonify, render_template, request


BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "students.db"
app = Flask(__name__)


@contextmanager
def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def initialize_database():
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                roll_no TEXT NOT NULL UNIQUE,
                class_name TEXT NOT NULL,
                marks REAL NOT NULL CHECK (marks >= 0 AND marks <= 100),
                contact TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """CREATE UNIQUE INDEX IF NOT EXISTS idx_students_roll_no_nocase
               ON students (roll_no COLLATE NOCASE)"""
        )


def validate_student(payload):
    if not isinstance(payload, dict):
        return None, "Send student details as a JSON object."

    name = str(payload.get("name", "")).strip()
    roll_no = str(payload.get("roll_no", "")).strip()
    class_name = str(payload.get("class_name", "")).strip()
    contact = str(payload.get("contact", "")).strip()

    try:
        marks = float(payload.get("marks", ""))
    except (TypeError, ValueError):
        return None, "Marks must be a number between 0 and 100."

    if not name or len(name) > 80:
        return None, "Name is required and must be 80 characters or fewer."
    if not roll_no or len(roll_no) > 24:
        return None, "Roll number is required and must be 24 characters or fewer."
    if not class_name or len(class_name) > 40:
        return None, "Class is required and must be 40 characters or fewer."
    if not 0 <= marks <= 100:
        return None, "Marks must be between 0 and 100."
    valid_contact = re.fullmatch(r"\+?\d[\d\s().-]*", contact)
    digit_count = sum(character.isdigit() for character in contact)
    if not valid_contact or not 7 <= digit_count <= 15:
        return None, "Enter a valid contact number (7 to 15 digits)."

    return {
        "name": name,
        "roll_no": roll_no,
        "class_name": class_name,
        "marks": marks,
        "contact": contact,
    }, None


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/students")
def list_students():
    search = request.args.get("q", "").strip()
    with get_connection() as connection:
        if search:
            pattern = f"%{search}%"
            rows = connection.execute(
                """SELECT * FROM students
                   WHERE name LIKE ? OR roll_no LIKE ? OR class_name LIKE ?
                   ORDER BY name COLLATE NOCASE""",
                (pattern, pattern, pattern),
            ).fetchall()
        else:
            rows = connection.execute(
                "SELECT * FROM students ORDER BY name COLLATE NOCASE"
            ).fetchall()
    return jsonify([dict(row) for row in rows])


@app.post("/api/students")
def create_student():
    student, error = validate_student(request.get_json(silent=True))
    if error:
        return jsonify({"error": error}), 400

    try:
        with get_connection() as connection:
            cursor = connection.execute(
                """INSERT INTO students (name, roll_no, class_name, marks, contact)
                   VALUES (:name, :roll_no, :class_name, :marks, :contact)""",
                student,
            )
            created = connection.execute(
                "SELECT * FROM students WHERE id = ?", (cursor.lastrowid,)
            ).fetchone()
    except sqlite3.IntegrityError:
        return jsonify({"error": "That roll number is already registered."}), 409

    return jsonify(dict(created)), 201


@app.put("/api/students/<int:student_id>")
def update_student(student_id):
    student, error = validate_student(request.get_json(silent=True))
    if error:
        return jsonify({"error": error}), 400

    try:
        with get_connection() as connection:
            cursor = connection.execute(
                """UPDATE students
                   SET name = :name, roll_no = :roll_no, class_name = :class_name,
                       marks = :marks, contact = :contact
                   WHERE id = :id""",
                {**student, "id": student_id},
            )
            if cursor.rowcount == 0:
                return jsonify({"error": "Student record not found."}), 404
            updated = connection.execute(
                "SELECT * FROM students WHERE id = ?", (student_id,)
            ).fetchone()
    except sqlite3.IntegrityError:
        return jsonify({"error": "That roll number is already registered."}), 409

    return jsonify(dict(updated))


@app.delete("/api/students/<int:student_id>")
def delete_student(student_id):
    with get_connection() as connection:
        cursor = connection.execute(
            "DELETE FROM students WHERE id = ?", (student_id,)
        )
    if cursor.rowcount == 0:
        return jsonify({"error": "Student record not found."}), 404
    return jsonify({"deleted": True})


initialize_database()


if __name__ == "__main__":
    app.run(debug=True)