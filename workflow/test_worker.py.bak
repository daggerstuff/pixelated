import unittest
import os
import tempfile
import json
import worker

class TestWorker(unittest.TestCase):
    def setUp(self):
        self.fd, self.temp_path = tempfile.mkstemp()
        self.original_log_path = worker.LOG_PATH
        worker.LOG_PATH = self.temp_path

    def tearDown(self):
        worker.LOG_PATH = self.original_log_path
        os.close(self.fd)
        os.remove(self.temp_path)

    def test_log_event(self):
        worker.log_event("evt_123", "test message")
        with open(self.temp_path, "r") as f:
            lines = f.readlines()
        self.assertEqual(len(lines), 1)
        data = json.loads(lines[0])
        self.assertEqual(data["event_id"], "evt_123")
        self.assertEqual(data["message"], "test message")
        self.assertIn("timestamp", data)

if __name__ == "__main__":
    unittest.main()
