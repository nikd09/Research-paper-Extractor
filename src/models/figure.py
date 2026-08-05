from dataclasses import dataclass


@dataclass
class Figure:

    number: str

    caption: str

    page: int

    image_path: str = ""