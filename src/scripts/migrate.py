import pandas as pd
import json
import os
from src.models.database import db, PortfolioItem, WishlistItem, init_db

def migrate_portfolio(excel_path: str):
    print("Migrating Portfolio...")
    try:
        xls = pd.ExcelFile(excel_path)
        sheets_of_interest = ['Acciones', 'Bonos', 'Cedear', 'Cripto']
        
        # Clear existing data? For now, yes, to avoid duplicates on re-run
        PortfolioItem.delete().execute()
        
        for sheet in sheets_of_interest:
            if sheet in xls.sheet_names:
                df = pd.read_excel(excel_path, sheet_name=sheet)
                valid_cols = [c for c in df.columns if c not in ['Mes', 'Total', 'Unnamed', 'INFLACION', 'Ganancia', 'Mes.1'] and not c.startswith('Unnamed')]
                
                if not df.empty:
                    latest_values = df.iloc[-1][valid_cols]
                    active_holdings = latest_values[latest_values > 0]
                    
                    for ticker, quantity in active_holdings.items():
                        PortfolioItem.create(
                            ticker=ticker,
                            quantity=float(quantity), # In this excel, values seem to be amounts, not quantities, but we store as quantity/value
                            category=sheet,
                            source_sheet=sheet
                        )
                        print(f"Imported {ticker} from {sheet}")
    except Exception as e:
        print(f"Error migrating portfolio: {e}")

def migrate_wishlist(json_path: str):
    print("Migrating Wishlist...")
    if os.path.exists(json_path):
        try:
            with open(json_path, 'r') as f:
                items = json.load(f)
                for ticker in items:
                    try:
                        WishlistItem.create(ticker=ticker)
                        print(f"Imported {ticker} to wishlist")
                    except Exception:
                        pass # Ignore duplicates
        except Exception as e:
            print(f"Error migrating wishlist: {e}")

if __name__ == "__main__":
    init_db()
    migrate_portfolio("/home/emi/Documentos/Proyectos/agente-financiero/Inversiones 2025.xlsx")
    migrate_wishlist("wishlist.json")
    print("Migration complete.")
