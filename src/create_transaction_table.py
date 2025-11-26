from src.database import db, Transaction

try:
    db.connect()
    db.create_tables([Transaction])
    print("Transaction table created successfully.")
except Exception as e:
    print(f"Error creating table: {e}")
