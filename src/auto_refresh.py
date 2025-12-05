import streamlit as st
from datetime import datetime
import time

def initialize_refresh_state():
    """
    Initialize session state variables for auto-refresh.
    Inicializa las variables de estado de sesión para auto-actualización.
    """
    if 'last_price_update' not in st.session_state:
        st.session_state.last_price_update = None
    if 'refresh_interval' not in st.session_state:
        st.session_state.refresh_interval = 60  # Default: 60 seconds
    if 'price_cache' not in st.session_state:
        st.session_state.price_cache = {}
    if 'cache_timestamp' not in st.session_state:
        st.session_state.cache_timestamp = {}

def get_time_since_last_update() -> float:
    """
    Get seconds elapsed since last price update.
    Obtiene los segundos transcurridos desde la última actualización de precios.
    
    Returns:
        float: Seconds since last update, or infinity if never updated.
    """
    if st.session_state.last_price_update is None:
        return float('inf')
    
    elapsed = time.time() - st.session_state.last_price_update
    return elapsed

def should_refresh() -> bool:
    """
    Determine if prices should be refreshed based on interval setting.
    Determina si los precios deben actualizarse según el intervalo configurado.
    
    Returns:
        bool: True if refresh is needed, False otherwise.
    """
    # If disabled (interval = 0), don't refresh
    if st.session_state.refresh_interval == 0:
        return False
    
    # If never updated, refresh
    if st.session_state.last_price_update is None:
        return True
    
    # Check if enough time has passed
    elapsed = get_time_since_last_update()
    return elapsed >= st.session_state.refresh_interval

def mark_updated():
    """
    Mark the current time as last update time.
    Marca el tiempo actual como última actualización.
    """
    st.session_state.last_price_update = time.time()

def format_countdown() -> str:
    """
    Format the countdown until next refresh.
    Formatea la cuenta regresiva hasta la próxima actualización.
    
    Returns:
        str: Formatted countdown string (e.g., "45s", "1m 30s", "N/A")
    """
    if st.session_state.refresh_interval == 0:
        return "Desactivado"
    
    if st.session_state.last_price_update is None:
        return "Actualizando..."
    
    elapsed = get_time_since_last_update()
    remaining = st.session_state.refresh_interval - elapsed
    
    if remaining <= 0:
        return "Actualizando..."
    
    # Format as minutes and seconds
    minutes = int(remaining // 60)
    seconds = int(remaining % 60)
    
    if minutes > 0:
        return f"{minutes}m {seconds}s"
    else:
        return f"{seconds}s"

def format_last_update() -> str:
    """
    Format the last update timestamp.
    Formatea el timestamp de la última actualización.
    
    Returns:
        str: Formatted timestamp (e.g., "10:32:45") or "Nunca" if never updated.
    """
    if st.session_state.last_price_update is None:
        return "Nunca"
    
    dt = datetime.fromtimestamp(st.session_state.last_price_update)
    return dt.strftime("%H:%M:%S")

def get_interval_options() -> dict:
    """
    Get available refresh interval options.
    Obtiene las opciones de intervalo de actualización disponibles.
    
    Returns:
        dict: Dictionary mapping display names to interval values in seconds.
    """
    return {
        "Desactivado": 0,
        "Cada 30 segundos": 30,
        "Cada 60 segundos": 60,
        "Cada 2 minutos": 120,
        "Cada 5 minutos": 300
    }

def get_cached_price(ticker: str, ttl: int = 30) -> float:
    """
    Get cached price if available and not expired.
    Obtiene el precio en caché si está disponible y no ha expirado.
    
    Args:
        ticker (str): Stock ticker symbol
        ttl (int): Time to live in seconds (default: 30)
    
    Returns:
        float: Cached price or None if not available/expired
    """
    if ticker not in st.session_state.price_cache:
        return None
    
    if ticker not in st.session_state.cache_timestamp:
        return None
    
    # Check if cache is still valid
    elapsed = time.time() - st.session_state.cache_timestamp[ticker]
    if elapsed > ttl:
        return None
    
    return st.session_state.price_cache[ticker]

def cache_price(ticker: str, price: float):
    """
    Cache a price with current timestamp.
    Almacena un precio en caché con el timestamp actual.
    
    Args:
        ticker (str): Stock ticker symbol
        price (float): Price to cache
    """
    st.session_state.price_cache[ticker] = price
    st.session_state.cache_timestamp[ticker] = time.time()

def clear_price_cache():
    """
    Clear all cached prices.
    Limpia todos los precios en caché.
    """
    st.session_state.price_cache = {}
    st.session_state.cache_timestamp = {}
