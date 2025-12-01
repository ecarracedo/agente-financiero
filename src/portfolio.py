import pandas as pd
from typing import List, Dict
from src.database import PortfolioItem

class Portfolio:
    """
    Manages the portfolio data from the SQLite database.
    Gestiona los datos del portafolio desde la base de datos SQLite.
    """
    def __init__(self):
        self.holdings = {} # Dict[Category, DataFrame]
        self.load_data()

    def load_data(self):
        """
        Loads data from the Database.
        Carga datos desde la base de datos.
        """
        try:
            items = PortfolioItem.select()
            data = []
            for item in items:
                data.append({
                    "ticker": item.ticker,
                    "quantity": item.quantity,
                    "category": item.category,
                    "source_sheet": item.source_sheet,
                    "avg_price": item.avg_price
                })
            
            if data:
                df = pd.DataFrame(data)
                # Group by category to match previous structure
                for category in df['category'].unique():
                    # Include avg_price in the DataFrame
                    self.holdings[category] = df[df['category'] == category].set_index('ticker')[['quantity', 'avg_price']]
            
        except Exception as e:
            print(f"Error loading portfolio from DB: {e}")

    def get_portfolio_summary(self) -> Dict[str, float]:
        """
        Returns a summary of the portfolio (Total Invested per Category).
        Devuelve un resumen del portafolio (Total Invertido por Categoría).
        """
        summary = {}
        try:
            # We need to query the DB to get avg_price, as self.holdings only has quantities
            items = PortfolioItem.select()
            for item in items:
                if item.category not in summary:
                    summary[item.category] = 0.0
                
                # Calculate estimated invested amount
                invested = item.quantity * item.avg_price
                summary[item.category] += invested
            
            return summary
        except Exception as e:
            print(f"Error calculating summary: {e}")
            return {}

    def get_holdings_with_valuations(self) -> pd.DataFrame:
        """
        Returns a DataFrame with all holdings including current price and valuations.
        """
        from src.market_data import get_current_price
        
        all_data = []
        
        for category, df_holdings in self.holdings.items():
            for ticker, row in df_holdings.iterrows():
                qty = row['quantity']
                avg_price = row['avg_price']
                
                # Fetch current price
                current_price = get_current_price(ticker)
                if current_price is None:
                    current_price = 0.0
                
                total_value = qty * current_price
                invested_capital = qty * avg_price
                
                gain_loss_amount = total_value - invested_capital
                gain_loss_pct = ((current_price - avg_price) / avg_price * 100) if avg_price > 0 else 0.0
                
                all_data.append({
                    "Ticker": ticker,
                    "Category": category,
                    "Quantity": qty,
                    "Avg Price": avg_price,
                    "Current Price": current_price,
                    "Total Value": total_value,
                    "Gain/Loss $": gain_loss_amount,
                    "Gain/Loss %": gain_loss_pct
                })
        
        if not all_data:
            return pd.DataFrame()
            
        return pd.DataFrame(all_data)

    def get_all_tickers(self) -> List[str]:
        """
        Returns a list of all unique tickers across all categories.
        Devuelve una lista de todos los tickers únicos en todas las categorías.
        """
        try:
            query = PortfolioItem.select(PortfolioItem.ticker).distinct()
            return [item.ticker for item in query]
        except Exception:
            return []

    def update_position(self, ticker: str, quantity_change: float, price: float, broker: str, date, category: str = "Acciones"):
        """
        Updates the position of a stock (Buy/Sell) and logs transaction.
        Actualiza la posición de una acción (Compra/Venta) y registra la transacción.
        """
        ticker = ticker.upper().strip()
        operation_type = "Compra" if quantity_change > 0 else "Venta"
        abs_quantity = abs(quantity_change)
        
        try:
            # Log Transaction
            from src.database import Transaction
            Transaction.create(
                date=date,
                ticker=ticker,
                operation_type=operation_type,
                quantity=abs_quantity,
                price=price,
                broker=broker,
                category=category
            )
            print(f"Logged transaction: {operation_type} {ticker}")

            # Check if exists (Ticker AND Broker)
            item = PortfolioItem.get_or_none((PortfolioItem.ticker == ticker) & (PortfolioItem.broker == broker))
            
            if item:
                new_quantity = item.quantity + quantity_change
                
                if quantity_change > 0: # Buy - Weighted Average
                    total_cost = (item.quantity * item.avg_price) + (quantity_change * price)
                    item.avg_price = total_cost / new_quantity
                
                else: # Sell - Net Investment Logic
                    # Reduce total cost by the amount recovered (Transaction Value)
                    # New Avg Price = (Old Total Cost - Recovered Amount) / Remaining Qty
                    current_total_cost = item.quantity * item.avg_price
                    recovered_amount = abs_quantity * price
                    new_total_cost = current_total_cost - recovered_amount
                    
                    if new_quantity > 0:
                        item.avg_price = new_total_cost / new_quantity
                    else:
                        item.avg_price = 0.0 # Should be deleted anyway

                if new_quantity <= 0:
                    # If sold all, delete
                    item.delete_instance()
                    print(f"Sold all {ticker} ({broker}). Removed from DB.")
                else:
                    item.quantity = new_quantity
                    item.save()
                    print(f"Updated {ticker} ({broker}): {new_quantity} | New Avg Price: {item.avg_price:.2f}")
            else:
                # If buying new
                if quantity_change > 0:
                    PortfolioItem.create(
                        ticker=ticker,
                        quantity=quantity_change,
                        category=category,
                        source_sheet="Manual",
                        broker=broker,
                        avg_price=price
                    )
                    print(f"Created new position {ticker} ({broker}): {quantity_change}")
                else:
                    print(f"Cannot sell {ticker}: Not in portfolio.")
            
            # Reload data to reflect changes
            self.load_data()
            
        except Exception as e:
            print(f"Error updating position: {e}")

    def get_transactions(self):
        """
        Returns all transactions.
        Devuelve todas las transacciones.
        """
        from src.database import Transaction
        return list(Transaction.select().dicts())

    def delete_ticker(self, ticker: str):
        """
        Deletes all records for a given ticker from Portfolio and Transactions.
        Elimina todos los registros de un ticker dado del Portafolio y Transacciones.
        """
        ticker = ticker.upper().strip()
        try:
            from src.database import Transaction
            
            # Delete from Portfolio
            q1 = PortfolioItem.delete().where(PortfolioItem.ticker == ticker)
            count1 = q1.execute()
            
            # Delete from Transactions
            q2 = Transaction.delete().where(Transaction.ticker == ticker)
            count2 = q2.execute()
            
            print(f"Deleted {ticker}: {count1} portfolio items, {count2} transactions.")
            self.load_data()
            return count1 + count2
        except Exception as e:
            print(f"Error deleting ticker {ticker}: {e}")
            return 0
