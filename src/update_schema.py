from peewee import SqliteDatabase
from playhouse.migrate import *

db = SqliteDatabase('finance.db')
migrator = SqliteMigrator(db)

broker_field = CharField(default='Unknown')
avg_price_field = FloatField(default=0.0)

try:
    with db.atomic():
        migrate(
            migrator.add_column('portfolioitem', 'broker', broker_field),
            migrator.add_column('portfolioitem', 'avg_price', avg_price_field),
        )
    print("Schema updated successfully.")
except Exception as e:
    print(f"Error updating schema: {e}")
