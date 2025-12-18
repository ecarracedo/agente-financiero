import pandas as pd
from typing import List, Dict
from src.models.database import PortfolioItem

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
                    "avg_price": item.avg_price,
                    "target_price": item.target_price
                })
            
            if data:
                df = pd.DataFrame(data)
                # Group by category to match previous structure
                for category in df['category'].unique():
                    # Include avg_price and target_price in the DataFrame
                    self.holdings[category] = df[df['category'] == category].set_index('ticker')[['quantity', 'avg_price', 'target_price']]
            
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
        from src.external.market_data import get_current_price
        
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
                    "Target Price": row.get('target_price', 0.0), # Add Target
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
            from src.models.database import Transaction
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
                
                else: # Sell
                    # Selling shares does NOT change the average price of the remaining shares.
                    # It only reduces the quantity.
                    # El precio promedio se mantiene igual al vender, solo cambia la cantidad.
                    pass

                # Use tolerance for float comparison
                if new_quantity <= 1e-9:
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
                    # print(f"Cannot sell {ticker}: Not in portfolio.")
                    raise ValueError(f"No puedes vender {ticker} en {broker} porque no lo tienes en cartera.")
            
            # Reload data to reflect changes
            self.load_data()
            
        except Exception as e:
            print(f"Error updating position: {e}")

    def get_transactions(self):
        """
        Returns all transactions.
        Devuelve todas las transacciones.
        """
        from src.models.database import Transaction
        return list(Transaction.select().dicts())

    def delete_ticker(self, ticker: str):
        """
        Deletes all records for a given ticker from Portfolio and Transactions.
        Elimina todos los registros de un ticker dado del Portafolio y Transacciones.
        """
        ticker = ticker.upper().strip()
        try:
            from src.models.database import Transaction
            
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

    def delete_transaction(self, transaction_id: int):
        """
        Deletes a specific transaction by ID and recalculates portfolio positions.
        Elimina una transacción específica por ID y recalcula las posiciones del portafolio.
        
        Args:
            transaction_id (int): The ID of the transaction to delete
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            from src.models.database import Transaction
            
            # Get the transaction before deleting
            transaction = Transaction.get_or_none(Transaction.id == transaction_id)
            if not transaction:
                print(f"Transaction {transaction_id} not found.")
                return False
            
            # Store transaction details
            ticker = transaction.ticker
            quantity = transaction.quantity
            price = transaction.price
            operation_type = transaction.operation_type
            broker = transaction.broker
            
            # Delete the transaction
            transaction.delete_instance()
            print(f"Deleted transaction {transaction_id}: {operation_type} {quantity} {ticker}")
            
            # Recalculate portfolio position for this ticker/broker
            # Get all remaining transactions for this ticker/broker
            remaining_txs = Transaction.select().where(
                (Transaction.ticker == ticker) & 
                (Transaction.broker == broker)
            ).order_by(Transaction.date)
            
            # Recalculate from scratch
            total_quantity = 0
            total_cost = 0
            
            for tx in remaining_txs:
                if tx.operation_type == "Compra":
                    total_cost += tx.quantity * tx.price
                    total_quantity += tx.quantity
                else:  # Venta
                    # Reduce cost proportionally
                    if total_quantity > 0:
                        avg_price = total_cost / total_quantity
                        total_cost -= tx.quantity * avg_price
                        total_quantity -= tx.quantity
            
            # Update or delete portfolio item
            item = PortfolioItem.get_or_none(
                (PortfolioItem.ticker == ticker) & 
                (PortfolioItem.broker == broker)
            )
            
            if total_quantity > 0:
                avg_price = total_cost / total_quantity if total_quantity > 0 else 0
                if item:
                    item.quantity = total_quantity
                    item.avg_price = avg_price
                    item.save()
                    print(f"Updated {ticker} ({broker}): {total_quantity} @ ${avg_price:.2f}")
                else:
                    # This shouldn't happen, but handle it
                    print(f"Warning: Portfolio item not found for {ticker} ({broker})")
            else:
                # No more holdings, delete portfolio item
                if item:
                    item.delete_instance()
                    print(f"Removed {ticker} ({broker}) from portfolio (no holdings left)")
            
            # Reload data
            self.load_data()
            return True
            
        except Exception as e:
            print(f"Error deleting transaction {transaction_id}: {e}")
            return False

    def update_target(self, ticker: str, target_price: float):
        """
        Updates the target price for all portfolio items with the given ticker.
        Actualiza el precio objetivo para todos los items del portafolio con el ticker dado.
        """
        ticker = ticker.upper().strip()
        try:
            # Update all rows for this ticker (regardless of broker)
            q = PortfolioItem.update(target_price=target_price).where(PortfolioItem.ticker == ticker)
            count = q.execute()
            print(f"Updated target for {ticker} to {target_price} ({count} items updated)")
            self.load_data()
            return count > 0
        except Exception as e:
            print(f"Error updating target for {ticker}: {e}")
            return False
