import tempfile
import unittest
from pathlib import Path

import app as student_app


class StudentApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.previous_database_path = student_app.DATABASE_PATH
        student_app.DATABASE_PATH = Path(self.temp_dir.name) / "test_students.db"
        student_app.initialize_database()
        student_app.app.config.update(TESTING=True)
        self.client = student_app.app.test_client()

    def tearDown(self):
        student_app.DATABASE_PATH = self.previous_database_path
        self.temp_dir.cleanup()

    def student(self, **overrides):
        details = {
            "name": "Maya Chen",
            "roll_no": "ST-2041",
            "class_name": "Year 10-A",
            "marks": 87.5,
            "contact": "+1 555 018 2200",
        }
        details.update(overrides)
        return details

    def test_create_search_update_and_delete_student(self):
        created = self.client.post("/api/students", json=self.student())
        self.assertEqual(created.status_code, 201)
        student_id = created.get_json()["id"]

        searched = self.client.get("/api/students?q=ST-2041")
        self.assertEqual([item["roll_no"] for item in searched.get_json()], ["ST-2041"])

        updated = self.client.put(
            f"/api/students/{student_id}", json=self.student(marks=93)
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.get_json()["marks"], 93)

        deleted = self.client.delete(f"/api/students/{student_id}")
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(self.client.get("/api/students").get_json(), [])

    def test_duplicate_roll_number_is_rejected(self):
        self.client.post("/api/students", json=self.student())
        duplicate = self.client.post(
            "/api/students", json=self.student(name="Another Student", roll_no="st-2041")
        )
        self.assertEqual(duplicate.status_code, 409)

    def test_search_for_missing_student_returns_empty_list(self):
        response = self.client.get("/api/students?q=not-in-the-register")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), [])

    def test_invalid_marks_and_contact_are_rejected(self):
        invalid_marks = self.client.post("/api/students", json=self.student(marks=101))
        invalid_contact = self.client.post(
            "/api/students", json=self.student(contact="not-a-number")
        )
        short_contact = self.client.post(
            "/api/students", json=self.student(contact="123456")
        )
        long_contact = self.client.post(
            "/api/students", json=self.student(contact="1234567890123456")
        )
        self.assertEqual(invalid_marks.status_code, 400)
        self.assertEqual(invalid_contact.status_code, 400)
        self.assertEqual(short_contact.status_code, 400)
        self.assertEqual(long_contact.status_code, 400)

    def test_missing_student_returns_not_found(self):
        updated = self.client.put("/api/students/999", json=self.student())
        deleted = self.client.delete("/api/students/999")
        self.assertEqual(updated.status_code, 404)
        self.assertEqual(deleted.status_code, 404)


if __name__ == "__main__":
    unittest.main()