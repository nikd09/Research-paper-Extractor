import json

from schemas.paper_schema import PaperAnalysis


class SchemaHelper:

    @staticmethod
    def json_schema() -> str:

        return json.dumps(
            PaperAnalysis.model_json_schema(),
            indent=2
        )