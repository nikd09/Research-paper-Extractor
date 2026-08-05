from pathlib import Path
from datetime import datetime

LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

LOG_FILE = LOG_DIR / "pipeline.log"


class Logger:

    @staticmethod
    def info(message: str):
        Logger._write("INFO", message)

    @staticmethod
    def success(message: str):
        Logger._write("SUCCESS", message)

    @staticmethod
    def warning(message: str):
        Logger._write("WARNING", message)

    @staticmethod
    def error(message: str):
        Logger._write("ERROR", message)

    @staticmethod
    def _write(level: str, message: str):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        line = f"[{timestamp}] [{level}] {message}"

        print(line)

        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")