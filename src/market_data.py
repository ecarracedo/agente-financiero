import yfinance as yf
import pandas as pd

def get_current_price(ticker: str) -> float:
    """
    Get the current price of a stock.
    Obtiene el precio actual de una acción.
    
    Args:
        ticker (str): The stock symbol (e.g., 'AAPL', 'TSLA').
        
    Returns:
        float: The current price or None if not found.
    """
    try:
        ticker_obj = yf.Ticker(ticker)
        # Try to get 'currentPrice', fallback to 'regularMarketPrice' or last close
        # Intenta obtener 'currentPrice', si no, usa 'regularMarketPrice' o el cierre anterior
        info = ticker_obj.info
        price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')
        return price
    except Exception as e:
        print(f"Error fetching price for {ticker}: {e}")
        return None

def get_historical_data(ticker: str, period: str = "1y") -> pd.DataFrame:
    """
    Get historical data for a stock.
    Obtiene datos históricos para una acción.
    
    Args:
        ticker (str): The stock symbol.
        period (str): The time period to download (default: "1y").
        
    Returns:
        pd.DataFrame: DataFrame with historical data (Open, High, Low, Close, Volume).
    """
    try:
        ticker_obj = yf.Ticker(ticker)
        history = ticker_obj.history(period=period)
        return history
    except Exception as e:
        print(f"Error fetching history for {ticker}: {e}")
        return pd.DataFrame()

def get_stock_info(ticker: str) -> dict:
    """
    Get detailed info for a stock.
    Obtiene información detallada de una acción.
    
    Args:
        ticker (str): The stock symbol.
        
    Returns:
        dict: Dictionary with stock information.
    """
    try:
        ticker_obj = yf.Ticker(ticker)
        return ticker_obj.info
    except Exception as e:
        print(f"Error fetching info for {ticker}: {e}")
        return {}
