from typing import List
from src.database import WishlistItem

class Wishlist:
    """
    Manages the wishlist of stocks using the SQLite database.
    Gestiona la lista de deseos de acciones usando la base de datos SQLite.
    """
    def __init__(self):
        pass

    def add_ticker(self, ticker: str):
        """
        Adds a ticker to the wishlist if it doesn't exist.
        Agrega un ticker a la lista de deseos si no existe.
        """
        ticker = ticker.upper().strip()
        try:
            WishlistItem.create(ticker=ticker)
        except Exception:
            pass # Already exists

    def remove_ticker(self, ticker: str):
        """
        Removes a ticker from the wishlist.
        Elimina un ticker de la lista de deseos.
        """
        try:
            WishlistItem.delete().where(WishlistItem.ticker == ticker).execute()
        except Exception as e:
            print(f"Error removing ticker: {e}")

    def get_items(self) -> List[str]:
        """
        Returns the list of tickers in the wishlist.
        Devuelve la lista de tickers en la lista de deseos.
        """
        try:
            query = WishlistItem.select()
            return [item.ticker for item in query]
        except Exception:
            return []
