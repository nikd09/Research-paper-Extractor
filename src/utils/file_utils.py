import hashlib
import re
from pathlib import Path


class FileUtils:

    MAX_NAME_LENGTH = 80

    @staticmethod
    def safe_name(filename: str) -> str:

        name = Path(filename).stem

        name = re.sub(r'[<>:"/\\|?*]', "", name)

        name = re.sub(r"\s+", "_", name)

        if len(name) > FileUtils.MAX_NAME_LENGTH:
            suffix = hashlib.sha1(name.encode("utf-8")).hexdigest()[:8]
            name = name[: FileUtils.MAX_NAME_LENGTH] + "_" + suffix

        return name