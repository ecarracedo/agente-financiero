import pandas as pd

def analyze_stock(ticker: str, current_price: float, history: pd.DataFrame) -> dict:
    """
    Analyze a stock to determine if it's cheap or expensive.
    Analiza una acción para determinar si está barata o cara.
    
    Args:
        ticker (str): Stock symbol.
        current_price (float): Current market price.
        history (pd.DataFrame): Historical price data.
        
    Returns:
        dict: Analysis results including signals.
    """
    if history.empty:
        return {"status": "Unknown", "reason": "No historical data"}

    # Calculate 52-week high and low
    # Calcular máximo y mínimo de 52 semanas
    high_52w = history['Close'].max()
    low_52w = history['Close'].min()
    
    # Calculate Moving Averages
    # Calcular Medias Móviles (50 y 200 días)
    ma_50 = history['Close'].rolling(window=50).mean().iloc[-1]
    ma_200 = history['Close'].rolling(window=200).mean().iloc[-1]

    analysis = {
        "current_price": current_price,
        "high_52w": high_52w,
        "low_52w": low_52w,
        "ma_50": ma_50,
        "ma_200": ma_200,
        "signals": []
    }

    # Simple logic for cheap/expensive
    # Lógica simple para determinar si está barata/cara
    if current_price <= low_52w * 1.05:
        analysis["signals"].append("Near 52-week Low (Buy Opportunity?) / Cerca del mínimo anual (¿Oportunidad de compra?)")
    elif current_price >= high_52w * 0.95:
        analysis["signals"].append("Near 52-week High (Sell Opportunity?) / Cerca del máximo anual (¿Oportunidad de venta?)")

    if current_price < ma_200:
        analysis["signals"].append("Below 200-day MA (Bearish/Cheap) / Por debajo de la media de 200 días")
    else:
        analysis["signals"].append("Above 200-day MA (Bullish) / Por encima de la media de 200 días")

    return analysis
