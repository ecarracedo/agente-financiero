from typing import List
from src.database import WishlistItem

class Wishlist:
    """
    Manages the wishlist of stocks using the SQLite database.
    Gestiona la lista de deseos de acciones usando la base de datos SQLite.
    """
    def __init__(self):
        pass

    def add_ticker(self, ticker: str, target_price: float = None):
        """
        Adds a ticker to the wishlist if it doesn't exist.
        Agrega un ticker a la lista de deseos si no existe.
        """
        ticker = ticker.upper().strip()
        try:
            WishlistItem.create(ticker=ticker, target_price=target_price)
        except Exception:
            pass # Already exists

    def update_target(self, ticker: str, target_price: float):
        """
        Updates the target price for a ticker.
        Actualiza el precio objetivo de un ticker.
        """
        try:
            query = WishlistItem.update(target_price=target_price).where(WishlistItem.ticker == ticker)
            query.execute()
        except Exception as e:
            print(f"Error updating target: {e}")

    def remove_ticker(self, ticker: str):
        """
        Removes a ticker from the wishlist.
        Elimina un ticker de la lista de deseos.
        """
        try:
            WishlistItem.delete().where(WishlistItem.ticker == ticker).execute()
        except Exception as e:
            print(f"Error removing ticker: {e}")

    def get_items(self) -> List[dict]:
        """
        Returns the list of items in the wishlist with their details.
        Devuelve la lista de items en la lista de deseos con sus detalles.
        """
        try:
            query = WishlistItem.select()
            return [{'ticker': item.ticker, 'target_price': item.target_price} for item in query]
        except Exception:
            return []
