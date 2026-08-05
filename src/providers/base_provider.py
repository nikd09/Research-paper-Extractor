from abc import ABC, abstractmethod
from typing import Optional, Type

from pydantic import BaseModel


class BaseProvider(ABC):

    @abstractmethod
    def generate(
        self,
        prompt: str,
        schema: Optional[Type[BaseModel]] = None
    ):
        """
        Generate response from AI model.
        """
        pass