from peewee import *
import datetime

db = SqliteDatabase('finance.db')

class BaseModel(Model):
    class Meta:
        database = db

class PortfolioItem(BaseModel):
    ticker = CharField()
    quantity = FloatField(default=0.0)
    category = CharField() # Acciones, Bonos, Cripto, etc.
    source_sheet = CharField()
    broker = CharField(default='Unknown')
    avg_price = FloatField(default=0.0)
    updated_at = DateTimeField(default=datetime.datetime.now)

class WishlistItem(BaseModel):
    ticker = CharField(unique=True)
    added_at = DateTimeField(default=datetime.datetime.now)

class Transaction(BaseModel):
    date = DateTimeField(default=datetime.datetime.now)
    ticker = CharField()
    operation_type = CharField() # Compra / Venta
    quantity = FloatField()
    price = FloatField()
    broker = CharField()
    category = CharField()

def init_db():
    db.connect()
    db.create_tables([PortfolioItem, WishlistItem, Transaction])
