from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(PROJECT_ROOT))

from src.utils.logger import Logger

Logger.info("Application Started")
Logger.success("Gemini Connected")
Logger.warning("Retrying another model")
Logger.error("Example Error")