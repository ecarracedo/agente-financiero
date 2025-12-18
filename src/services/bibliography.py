from src.models.database import BibliographyItem
from typing import List, Dict

class Bibliography:
    """
    Manages the bibliography data.
    Gestiona los datos de la bibliografía.
    """
    def __init__(self):
        pass

    def add_item(self, title: str, author: str, year: int = None, category: str = "General", link: str = None, description: str = None):
        """
        Adds a new item to the bibliography.
        Agrega un nuevo ítem a la bibliografía.
        """
        try:
            BibliographyItem.create(
                title=title,
                author=author,
                year=year,
                category=category,
                link=link,
                description=description
            )
            print(f"Added bibliography item: {title}")
            return True
        except Exception as e:
            print(f"Error adding bibliography item: {e}")
            return False

    def get_items(self) -> List[Dict]:
        """
        Returns all bibliography items.
        Devuelve todos los ítems de la bibliografía.
        """
        try:
            items = BibliographyItem.select().order_by(BibliographyItem.added_at.desc())
            return list(items.dicts())
        except Exception as e:
            print(f"Error fetching bibliography: {e}")
            return []

    def delete_item(self, item_id: int):
        """
        Deletes a bibliography item by ID.
        Elimina un ítem de la bibliografía por ID.
        """
        try:
            item = BibliographyItem.get_by_id(item_id)
            item.delete_instance()
            print(f"Deleted bibliography item ID: {item_id}")
            return True
        except Exception as e:
            print(f"Error deleting bibliography item: {e}")
            return False
