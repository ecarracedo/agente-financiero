from peewee import *
from playhouse.migrate import *

db = SqliteDatabase('finance.db')
migrator = SqliteMigrator(db)

target_price_field = FloatField(null=True)

def run_db_migration():
    try:
        with db.atomic():
            migrate_op = migrator.add_column('portfolioitem', 'target_price', target_price_field)
            migrate(migrate_op)
        print("Migration successful: Added 'target_price' column to PortfolioItem.")
    except Exception as e:
        if "duplicate column name" in str(e).lower():
            print("Column 'target_price' already exists.")
        else:
            print(f"Migration failed: {e}")

if __name__ == "__main__":
    run_db_migration()
