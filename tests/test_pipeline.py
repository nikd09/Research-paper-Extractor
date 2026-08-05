import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.core.pdf_reader import PDFReader
from src.pipeline.pipeline import Pipeline
from src.utils.file_utils import FileUtils
from src.utils.output_checker import OutputChecker


def main():

    print("=" * 80)
    print("ENGINEERING KNOWLEDGE EXTRACTION PIPELINE")
    print("=" * 80)

    documents = PDFReader.read_all()

    pipeline = Pipeline()

    for document in documents:

        base_name = FileUtils.safe_name(document.filename)

        if OutputChecker.already_processed(base_name):
            print(f"[SKIP] {document.filename}")
            continue

        print("\n")
        print("=" * 80)
        print(document.filename)
        print("=" * 80)

        pipeline.run(document)

    print("\n")
    print("=" * 80)
    print("PIPELINE COMPLETED")
    print("=" * 80)


if __name__ == "__main__":
    main()