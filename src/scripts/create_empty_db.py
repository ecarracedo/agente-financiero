import os
from peewee import SqliteDatabase
import sys
# Ensure the project root is in sys.path so we can import the 'src' package
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.models.database import PortfolioItem, WishlistItem, Transaction, BibliographyItem

def create_empty_db(db_path: str = "finance.db"):
    """Create an empty SQLite database (finance.db) with the required tables but no data.
    This is intended for the initial configuration of the application.
    The function rebinds the Peewee models to a new database instance, creates the tables,
    and then closes the connection.
    """
    # Ensure we don't accidentally overwrite an existing file unless intended
    if os.path.exists(db_path):
        print(f"[INFO] Database file '{db_path}' already exists. It will be overwritten.")
        os.remove(db_path)

    empty_db = SqliteDatabase(db_path)

    # Rebind models to the new database instance
    for model in [PortfolioItem, WishlistItem, Transaction, BibliographyItem]:
        model._meta.database = empty_db

    empty_db.connect()
    empty_db.create_tables([PortfolioItem, WishlistItem, Transaction, BibliographyItem])
    empty_db.close()
    print(f"[SUCCESS] Empty database created at '{db_path}'.")


if __name__ == "__main__":
    create_empty_db()
