import json
from pathlib import Path

from src.utils.logger import Logger


class JSONWriter:

    @staticmethod
    def save(data, output_path):

        output_path = Path(output_path)

        output_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        with open(
            output_path,
            "w",
            encoding="utf-8",
        ) as f:

            json.dump(
                data.model_dump(),
                f,
                indent=4,
                ensure_ascii=False,
            )

        Logger.success(
            f"JSON saved -> {output_path}"
        )