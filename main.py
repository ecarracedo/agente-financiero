import streamlit as st
import pandas as pd
import time
from src.portfolio import Portfolio
from src.wishlist import Wishlist
from src.market_data import get_current_price, get_historical_data
from src.analyzer import analyze_stock
from src.bibliography import Bibliography
from src.auto_refresh import (
    initialize_refresh_state,
    should_refresh,
    mark_updated,
    format_countdown,
    format_last_update,
    get_interval_options,
    get_time_since_last_update,
    clear_price_cache
)

# Page Config
st.set_page_config(page_title="Agente Financiero", layout="wide")

# Determine run_every for the fragment
# We pass this to the fragment to control update frequency
fragment_refresh_interval = st.session_state.get('refresh_interval', 60)
# If 0, we can pass None or a very large number, or handle it inside. 
# st.fragment run_every accepts int/float (seconds). None means no auto-rerun.
run_every_val = fragment_refresh_interval if fragment_refresh_interval > 0 else None

# Title
st.title("💰 Agente Financiero Personal (v1.1)")

# Initialize auto-refresh state
initialize_refresh_state()

# Sidebar
st.sidebar.header("Configuración")
excel_path = "/home/emi/Documentos/Proyectos/agente-financiero/Inversiones 2025.xlsx"

# Auto-refresh controls
st.sidebar.markdown("---")
st.sidebar.subheader("🔄 Auto-actualización")

interval_options = get_interval_options()
interval_labels = list(interval_options.keys())

# Find current selection
current_interval = st.session_state.refresh_interval
current_label = [k for k, v in interval_options.items() if v == current_interval][0]
current_index = interval_labels.index(current_label)

selected_label = st.sidebar.selectbox(
    "Intervalo de actualización:",
    interval_labels,
    index=current_index,
    key="refresh_interval_selector"
)

# Update interval if changed
st.session_state.refresh_interval = interval_options[selected_label]

# JavaScript auto-refresh injection
# JavaScript auto-refresh injection REMOVED in favor of st.fragment





# Manual refresh button - use a unique key to avoid conflicts
if st.sidebar.button("🔄 Actualizar Ahora", key="manual_refresh_btn", use_container_width=True):
    # Set flags to force refresh
    st.session_state.last_price_update = None  # Reset to force refresh
    st.session_state.force_refresh = True  # Flag to bypass cache completely
    clear_price_cache()
    st.rerun()

# Update timestamp on page load (for auto-refresh tracking)
# This ensures the "Última actualización" shows when auto-refresh occurred
if st.session_state.last_price_update is None or \
   (st.session_state.refresh_interval > 0 and 
    get_time_since_last_update() >= st.session_state.refresh_interval):
    mark_updated()
    clear_price_cache()


# Load Portfolio
# @st.cache_data(ttl=60) # Cache removed to prevent stale object issues during dev
def load_portfolio():
    return Portfolio()

try:
    portfolio = load_portfolio()
    st.sidebar.success("Portafolio cargado (DB)")
    # DEBUG
    # print("Portfolio attributes:", dir(portfolio)) 
    # if not hasattr(portfolio, 'delete_ticker'):
    #    st.error("CRITICAL: delete_ticker method missing from Portfolio object!")
except Exception as e:
    st.sidebar.error(f"Error cargando portafolio: {e}")
    st.stop()

# Initialize Wishlist
wishlist = Wishlist()

# Delete Ticker Section
with st.sidebar.expander("🗑️ Zona de Peligro"):
    st.warning("Acciones irreversibles")
    del_ticker = st.text_input("Eliminar Ticker (Todo)", placeholder="Ej: AAPL").upper()
    if st.button("Eliminar Ticker"):
        if del_ticker:
            count = portfolio.delete_ticker(del_ticker)
            if count > 0:
                st.success(f"Eliminados {count} registros de {del_ticker}.")
                st.rerun()
            else:
                st.error(f"No se encontraron registros de {del_ticker} o hubo un error.")

# Tabs
tab1, tab2, tab_alerts, tab3, tab4, tab5 = st.tabs(["📊 Portafolio", "💸 Operaciones", "🔔 Alertas", "🚀 Oportunidades", "📝 Wishlist", "📚 Bibliografía"])

# ... (Previous tab1 and tab2 content remains)

with tab_alerts:
    st.header("🔔 Centro de Alertas")
    
    # Section 1: My Assets
    st.subheader("Mis Activos en Cartera")
    st.info("Configura alertas de precio para los activos que ya posees.")
    
    # Get portfolio holdings (we need unique tickers and their targets)
    # We can use get_holdings_with_valuations() which already fetches everything
    df_holdings = portfolio.get_holdings_with_valuations()
    
    if not df_holdings.empty:
        # Group by Ticker to avoid duplicates if multiple brokers
        # We just need Ticker, Current Price, Target Price.
        # Check if multiple rows (brokers) have different targets?
        # logic in Portfolio.update_target updates ALL rows. So they should be consistent.
        
        # Unique tickers
        unique_holdings = df_holdings[['Ticker', 'Current Price', 'Target Price']].drop_duplicates(subset=['Ticker'])
        
        # UI Header
        h1, h2, h3, h4 = st.columns([1.5, 1.5, 2, 3])
        h1.markdown("**Ticker**")
        h2.markdown("**Precio Actual**")
        h3.markdown("**Precio Objetivo**")
        h4.markdown("**Estado**")
        st.markdown("---")
        
        for idx, row in unique_holdings.iterrows():
            ticker = row['Ticker']
            current_price = row['Current Price']
            target_price = row['Target Price']
            
            with st.container():
                c1, c2, c3, c4 = st.columns([1.5, 1.5, 2, 3])
                
                with c1:
                    st.write(f"**{ticker}**")
                
                with c2:
                    st.write(f"${current_price:,.2f}")
                
                with c3:
                    # Editable Target
                    new_target = st.number_input(
                        "Target",
                        value=target_price if target_price else 0.0,
                        step=0.1,
                        key=f"alert_port_{ticker}",
                        label_visibility="collapsed"
                    )
                    
                    if new_target != (target_price if target_price else 0.0):
                        if portfolio.update_target(ticker, new_target if new_target > 0 else None):
                            # st.rerun() # Optional
                            pass

                with c4:
                    if new_target > 0:
                        diff = current_price - new_target
                        pct_diff = (diff / current_price) * 100
                        
                        if diff == 0:
                             st.success("🔔 **¡OBJETIVO ALCANZADO!**")
                        elif new_target < current_price: 
                            # Target below (Stop Loss? or Buy Dip?)
                            # Usually for OWNED assets:
                            # Target > Current = Take Profit (Sell Alert)
                            # Target < Current = Stop Loss (Sell Alert) or Buy More (Buy Alert)
                            # Context matters. Let's just show distance.
                            if current_price <= new_target:
                                st.error(f"🔔 **¡ALERTA!** Precio debajo del objetivo (${new_target})")
                            else:
                                st.info(f"Falta bajar {pct_diff:.2f}% hasta ${new_target}")
                        else:
                            # Target above
                            if current_price >= new_target:
                                st.success(f"🔔 **¡OBJETIVO ALCANZADO!** (${new_target})")
                            else:
                                pct_up = ((new_target - current_price) / current_price) * 100
                                st.info(f"Falta subir {pct_up:.2f}% hasta ${new_target}")
                    else:
                        st.caption("Sin alerta configurada")
            st.markdown("---")
    else:
        st.info("No tienes activos en el portafolio.")

    # Section 2: Wishlist
    st.subheader("Alertas de Wishlist")
    st.markdown("Gestiona estas alertas en la pestaña **Wishlist**.")
    
    w_items = wishlist.get_items()
    if w_items:
         # Simplified view
         
         # Identify items with alerts first to check if we need headers
         alert_items = [item for item in w_items if item.get('target_price') and item['target_price'] > 0]
         
         if alert_items:
             
             # Header
             wh1, wh2, wh3, wh4 = st.columns([1.5, 1.5, 1.5, 3])
             wh1.markdown("**Ticker**")
             wh2.markdown("**Precio Objetivo**")
             wh3.markdown("**Precio Actual**")
             wh4.markdown("**Estado**")
             st.markdown("---")
             
             for item in alert_items:
                 ticker = item['ticker']
                 tgt = item['target_price']
                 price = get_current_price(ticker)
                 
                 with st.container():
                     wc1, wc2, wc3, wc4 = st.columns([1.5, 1.5, 1.5, 3])
                     
                     with wc1:
                         st.write(f"**{ticker}**")
                     
                     with wc2:
                         st.write(f"${tgt:,.2f}")
                     
                     with wc3:
                         if price:
                             st.write(f"${price:,.2f}")
                         else:
                             st.write("N/A")
                     
                     with wc4:
                         if price:
                             diff = price - tgt
                             pct_diff = (diff / price) * 100
                             
                             if diff == 0:
                                  st.success("🔔 **¡OBJETIVO ALCANZADO!**")
                             elif tgt < price: 
                                 # Target below (Waiting for drop)
                                 if price <= tgt:
                                     st.success(f"🔔 **¡COMPRA!** (${tgt})")
                                 else:
                                     st.info(f"Falta bajar {pct_diff:.2f}%")
                             else:
                                 # Target above (Waiting for rise)
                                 if price >= tgt:
                                     st.success(f"🔔 **¡OBJETIVO ALCANZADO!** (${tgt})")
                                 else:
                                     # pct to go up
                                     pct_up = ((tgt - price) / price) * 100
                                     st.info(f"Falta subir {pct_up:.2f}%")
                         else:
                             st.caption("Esperando precio...")
                 st.markdown("---")
         else:
             st.info("No tienes alertas activas en la Wishlist. Configura un 'Precio Objetivo' en la pestaña Wishlist.")
    else:
        st.write("Sin items en wishlist.")



with tab1:
    st.header("Mi Portafolio")
    
    # Summary Metrics
    summary = portfolio.get_portfolio_summary()
    if summary:
        cols = st.columns(len(summary))
        for i, (cat, val) in enumerate(summary.items()):
            cols[i].metric(cat, f"{val:,.2f}")
    else:
        st.info("Portafolio vacío.")
    
    # Detailed Holdings

    
    @st.fragment(run_every=run_every_val)
    def render_holdings_table():
        """
        Renders the holdings table with partial auto-refresh support.
        Calculates and displays current portfolio valuations, gains/losses, and recent updates.
        """
        # If this runs via auto-refresh (implicit), we might want to clear cache to get fresh prices.
        # However, st.fragment just re-runs the function. 
        # We need to enforce price fetching if we want updates.
        # We can check time or just force it if we assume this runs on interval.
        # A simple strategy: always clear cache for the relevant tickers or rely on cache expiration (TTL).
        # auto_refresh.py has get_cached_price with TTL=30.
        # If we just call portfolio.get_holdings_with_valuations(), it calls get_current_price.
        # We should ensure get_current_price fetches new data if enough time passed.
        
        # Force clear cache if we want strictly fresh data on every partial run
        # But this might be too aggressive if run_every is small.
        # Let's rely on standard logic:
        # If we are here, we want to show current state.
        
        # Recalculate valuations (this fetches prices)
        # We might need to ensure 'portfolio' object is fresh or methods are stateless regarding cache.
        # The portfolio object interacts with 'src.market_data'.
        
        # Little trick: to see updates, we need 'get_current_price' to return fresh values.
        # Its internal cache might hold old values. 
        # Let's call clear_price_cache() here to be sure, OR rely on TTL.
        # Given the user wants "Actualizar Ahora" experience but partial.
        clear_price_cache() 
        
        df_holdings = portfolio.get_holdings_with_valuations()
        
        if not df_holdings.empty:
            # Function to apply color formatting
            def color_gain_loss(val):
                """Apply color based on gain/loss value"""
                if val > 0:
                    return 'color: green; font-weight: bold'
                elif val < 0:
                    return 'color: red; font-weight: bold'
                else:
                    return 'font-weight: bold'
            
            # Apply styling to G/P columns
            styled_df = df_holdings.style.applymap(
                color_gain_loss,
                subset=['Gain/Loss $', 'Gain/Loss %']
            ).format({
                'Quantity': '{:.2f}',
                'Avg Price': '$ {:.2f}',
                'Current Price': '$ {:.2f}',
                'Target Price': '$ {:.2f}',
                'Total Value': '$ {:.2f}',
                'Gain/Loss $': '$ {:.2f}',
                'Gain/Loss %': '{:.2f} %'
            })
            
            st.dataframe(
                styled_df,
                column_config={
                    "Ticker": "Ticker",
                    "Category": "Categoría"
                },
                hide_index=True,
                use_container_width=True
            )
            
            # Show last update time for this fragment
            st.caption(f"Última actualización de precios: {time.strftime('%H:%M:%S')}")
            
        else:
            st.info("No hay activos en el portafolio.")

    render_holdings_table()

    st.markdown("---")
    st.subheader("📊 Gráficos de Rendimiento")
    
    from src.charts import plot_portfolio_composition, plot_asset_allocation, plot_gain_loss_by_stock
    
    c1, c2 = st.columns(2)
    with c1:
        plot_portfolio_composition(portfolio)
    with c2:
        plot_asset_allocation(portfolio)
    
    st.markdown("---")
    plot_gain_loss_by_stock(portfolio)


with tab2:
    st.header("Registrar Operación")
    
    col1, col2 = st.columns(2)
    
    with col1:
        op_type = st.radio("Tipo de Operación", ["Compra", "Venta"], horizontal=True, key="op_type")
        # Ticker Input with Key for clearing
        if "op_ticker" not in st.session_state: st.session_state.op_ticker = ""
        ticker_input = st.text_input("Ticker", placeholder="Ej: AAPL", key="op_ticker").upper()
        
        # Market Selector (Default Argentina)
        market_op = st.selectbox("Mercado", ["Argentina", "EE.UU."], key="op_market")
        broker_op = st.selectbox("Broker", ["Eco", "PPI", "Galicia", "Binance"], key="op_broker")
        
        # Logic to handle ticker suffix
        ticker_op = ticker_input.strip()
        if market_op == "Argentina" and ticker_op and not ticker_op.endswith(".BA"):
            ticker_op += ".BA"
        
    with col2:
        # Quantity (Integer)
        if "op_qty" not in st.session_state: st.session_state.op_qty = 0
        quantity_op = st.number_input("Cantidad / Monto Nominal", min_value=0, step=1, key="op_qty")
        
        # Auto-fetch price
        current_price = 0.0
        if ticker_op:
            # Pre-validation for US Market
            if market_op == "EE.UU." and ticker_op.endswith(".BA"):
                st.warning(f"⚠️ Si seleccionas EE.UU., el ticker no debería terminar en .BA. ¿Quisiste decir '{ticker_op.replace('.BA', '')}'?")
            else:
                fetched_price = get_current_price(ticker_op)
                if fetched_price:
                    current_price = fetched_price
        
        # Price Input
        if "op_price" not in st.session_state: st.session_state.op_price = 0.0
        # If auto-fetched, update the widget value if it's 0 or if we want to force it? 
        # Better to let user see it. But st.number_input value is fixed by key if present.
        # We can use 'value' argument but it conflicts with key if we want to update it dynamically.
        # For now, let's keep it simple. If we want to auto-fill, we might need to update session_state.
        if current_price > 0 and st.session_state.op_price == 0.0:
             st.session_state.op_price = current_price

        price_op = st.number_input("Precio Unitario", min_value=0.0, step=0.01, format="%.2f", key="op_price")
        
        category_op = st.selectbox("Categoría (solo para compras nuevas)", ["Acciones", "Bonos", "Cedear", "Cripto", "FCI", "Letras", "ON"], key="op_category")
        date_op = st.date_input("Fecha de Operación", key="op_date")
        
    # Callback for submission
    def submit_op():
        # Get values from session state
        raw_ticker = st.session_state.op_ticker.upper().strip()
        market = st.session_state.op_market
        qty = st.session_state.op_qty
        price = st.session_state.op_price
        op_type = st.session_state.op_type
        broker = st.session_state.op_broker
        category = st.session_state.op_category
        date = st.session_state.op_date
        
        if raw_ticker and qty > 0 and price > 0:
            # Handle Suffix
            ticker = raw_ticker
            if market == "Argentina" and not ticker.endswith(".BA"):
                ticker += ".BA"
            
            # Validate Market Consistency
            if market == "EE.UU." and ticker.endswith(".BA"):
                st.session_state.tx_msg = ("error", f"❌ Error: El ticker '{ticker}' tiene sufijo .BA pero el mercado es EE.UU.")
                return

            # Validate Existence
            # Note: get_current_price might be slow for a callback, but acceptable here.
            valid_price = get_current_price(ticker)
            if valid_price is None:
                st.session_state.tx_msg = ("error", f"❌ Error: El ticker '{ticker}' no parece existir en el mercado seleccionado.")
                return
            
            # Execute
            try:
                qty_change = qty if op_type == "Compra" else -qty
                portfolio.update_position(ticker, qty_change, price, broker, date, category)
                
                # Success & Clear
                st.session_state.tx_msg = ("success", f"✅ Operación registrada: {op_type} {qty} de {ticker} en {broker} a ${price}")
                st.session_state.op_ticker = ""
                st.session_state.op_qty = 0
                st.session_state.op_price = 0.0
                # Reset date to today
                from datetime import date
                st.session_state.op_date = date.today()
            except ValueError as e:
                st.session_state.tx_msg = ("error", f"❌ Error: {str(e)}")
            except Exception as e:
                st.session_state.tx_msg = ("error", f"❌ Error inesperado: {str(e)}")
        else:
            st.session_state.tx_msg = ("error", "Por favor completa todos los campos (Ticker, Cantidad, Precio).")

    st.button("Confirmar Operación", type="primary", on_click=submit_op)
    
    # Display Message if exists
    if "tx_msg" in st.session_state:
        m_type, m_text = st.session_state.tx_msg
        if m_type == "success":
            st.success(m_text)
        else:
            st.error(m_text)
        # Clear message after display so it doesn't persist forever (optional, or keep until next action)
        del st.session_state.tx_msg

    st.markdown("---")
    st.subheader("📜 Historial de Transacciones")
    transactions = portfolio.get_transactions()
    if transactions:
        df_trans = pd.DataFrame(transactions)
        # Format date
        df_trans['date'] = pd.to_datetime(df_trans['date']).dt.strftime('%Y-%m-%d')
        # Calculate Total
        df_trans['total'] = df_trans['quantity'] * df_trans['price']
        
        # Sort by date descending
        df_trans = df_trans.sort_values(by='date', ascending=False)
        
        # Header row
        col1, col2, col3, col4, col5, col6, col7, col8, col9 = st.columns([1.2, 1, 1, 0.8, 0.8, 1, 1, 1, 0.6])
        with col1:
            st.markdown("**Fecha**")
        with col2:
            st.markdown("**Ticker**")
        with col3:
            st.markdown("**Operación**")
        with col4:
            st.markdown("**Cant.**")
        with col5:
            st.markdown("**Precio**")
        with col6:
            st.markdown("**Total**")
        with col7:
            st.markdown("**Broker**")
        with col8:
            st.markdown("**Categoría**")
        with col9:
            st.markdown("**Acción**")
        st.markdown("---")

        # Display each transaction with a delete button
        for idx, row in df_trans.iterrows():
            col1, col2, col3, col4, col5, col6, col7, col8, col9 = st.columns([1.2, 1, 1, 0.8, 0.8, 1, 1, 1, 0.6])
            
            with col1:
                st.text(row['date'])
            with col2:
                st.text(row['ticker'])
            with col3:
                st.text(row['operation_type'])
            with col4:
                st.text(f"{row['quantity']:.0f}")
            with col5:
                st.text(f"${row['price']:.2f}")
            with col6:
                st.text(f"${row['total']:.2f}")
            with col7:
                st.text(row['broker'])
            with col8:
                st.text(row['category'])
            with col9:
                if st.button("🗑️", key=f"del_tx_{row['id']}", help="Eliminar transacción"):
                    if portfolio.delete_transaction(row['id']):
                        st.rerun()
                    else:
                        st.error("Error al eliminar la transacción")
        
    else:
        st.info("No hay transacciones registradas.")

with tab3:
    st.header("Análisis de Oportunidades")
    st.info("Analizando tus activos para detectar oportunidades de compra/venta...")
    
    tickers = portfolio.get_all_tickers()
    
    # Filter for valid tickers (simple check)
    # Adding .BA for Argentinian stocks if needed, or assuming US tickers.
    # Given the tickers (GGAL, YPF), they are likely ADSs or local. 
    # Let's try fetching as is first, or append .BA if they are local.
    # For now, let's assume they are US tickers or have the correct suffix.
    # Actually, many look like local tickers (ALUA, TXAR). 
    # Let's add a selector or try both.
    
    market_suffix = st.sidebar.selectbox("Mercado", ["EE.UU. (Sin sufijo)", "Argentina (.BA)"], index=1)
    suffix = ".BA" if "Argentina" in market_suffix else ""
    
    if st.button("Analizar Mercado"):
        progress_bar = st.progress(0)
        results = []
        
        for i, ticker in enumerate(tickers):
            full_ticker = f"{ticker}{suffix}"
            # Skip crypto/bonds for now if yfinance doesn't support them well without specific mapping
            if ticker in ['BTC', 'AL30', 'AL29']: 
                continue
                
            price = get_current_price(full_ticker)
            if price:
                history = get_historical_data(full_ticker)
                analysis = analyze_stock(full_ticker, price, history)
                
                if analysis["signals"]:
                    results.append({
                        "Ticker": ticker,
                        "Precio": price,
                        "Señales": ", ".join(analysis["signals"]),
                        "Razón": " / ".join(analysis["signals"])
                    })
            progress_bar.progress((i + 1) / len(tickers))
            
        if results:
            st.success(f"Se encontraron {len(results)} oportunidades!")
            st.dataframe(pd.DataFrame(results))
        else:
            st.warning("No se detectaron oportunidades claras con los criterios actuales.")

from src.wishlist import Wishlist

# ... (inside tab3)

with tab4:
    st.header("Wishlist")
    st.info("Gestiona tus acciones favoritas para monitorear.")
    
    # wishlist instantiated globally
    
    # Add new ticker
    col1, col2, col3 = st.columns([2, 1, 1])
    with col1:
        new_ticker = st.text_input("Agregar Ticker:", placeholder="Ej: AAPL, GGAL").upper()
    with col2:
        market_wl = st.selectbox("Mercado", ["EE.UU.", "Argentina"], key="wl_market")
    with col3:
        if st.button("Agregar", key="btn_add_wl"):
            if new_ticker:
                # Handle suffix
                final_ticker = new_ticker.strip()
                if market_wl == "Argentina" and not final_ticker.endswith(".BA"):
                    final_ticker += ".BA"
                
                # Validate Market Consistency
                if market_wl == "EE.UU." and final_ticker.endswith(".BA"):
                    st.error(f"❌ Error: El ticker '{final_ticker}' tiene sufijo .BA pero el mercado es EE.UU. Cambia el mercado a Argentina o quita el sufijo.")
                else:
                    # Validate
                    with st.spinner(f"Validando {final_ticker}..."):
                        price = get_current_price(final_ticker)
                        if price:
                            wishlist.add_ticker(final_ticker)
                            st.success(f"¡{final_ticker} agregado correctamente! (Precio actual: ${price})")
                            st.rerun()
                        else:
                            st.error(f"No se encontró el ticker '{final_ticker}'. Verifica el símbolo y el mercado.")

    # Display wishlist
    items = wishlist.get_items()
    if items:
        st.subheader("Tus Acciones en Seguimiento")
        
        # Header
        h1, h2, h3, h4, h5 = st.columns([1.5, 1.5, 1.5, 2, 0.5])
        h1.markdown("**Ticker**")
        h2.markdown("**Precio Actual**")
        h3.markdown("**Precio Objetivo**")
        h4.markdown("**Distancia / Alerta**")
        h5.markdown("") # Delete btn
        
        for item in items:
            ticker = item['ticker']
            target_price = item['target_price']
            
            display_ticker = ticker.replace(".BA", "")
            
            with st.container():
                c1, c2, c3, c4, c5 = st.columns([1.5, 1.5, 1.5, 2, 0.5])
                
                # 1. Ticker
                with c1:
                    st.write(f"**{display_ticker}**")
                
                # 2. Current Price
                current_price = get_current_price(ticker)
                with c2:
                    if current_price:
                        st.write(f"${current_price:,.2f}")
                    else:
                        st.write("N/A")

                # 3. Target Price Input (Editable)
                with c3:
                    # Use a key unique to the ticker
                    new_target = st.number_input(
                        "Target", 
                        value=target_price if target_price else 0.0, 
                        step=0.1, 
                        key=f"target_{ticker}",
                        label_visibility="collapsed"
                    )
                    
                    # Check if changed and update DB
                    # Note: This updates on every change (enter/blur). 
                    # We compare with db value 'target_price'. 
                    # Ideally we only update if different.
                    if new_target != (target_price if target_price else 0.0):
                         wishlist.update_target(ticker, new_target if new_target > 0 else None)
                         # We might need to rerun to refresh the 'item' dict in next loop, 
                         # but st.number_input keeps the state.
                         # A rerun would reflect the change cleanly.
                         # st.rerun() # Be careful with infinite reruns if values float precision differs.

                # 4. Analysis / Alert
                with c4:
                    if current_price and new_target > 0:
                        # Assuming 'Buy' logic: Target is usually below current price (waiting for dip)
                        # But user might want 'Sell' alert (target above).
                        # Let's interpret: 
                        # If Target < Current: Buying the dip. Alert if Current <= Target.
                        # If Target > Current: Breakout/Sell. Alert if Current >= Target.
                        
                        diff = current_price - new_target
                        pct_diff = (diff / current_price) * 100
                        
                        if diff == 0:
                             st.success("🔔 **¡OBJETIVO ALCANZADO!**")
                        elif new_target < current_price:
                            # Target is below (waiting for drop)
                            if current_price <= new_target:
                                st.success(f"🔔 **¡COMPRA!** Estás debajo del objetivo (${new_target})")
                            else:
                                st.info(f"Falta bajar {pct_diff:.2f}%")
                        else:
                            # Target is above (waiting to rise)
                            if current_price >= new_target:
                                st.success(f"🔔 **¡OBJETIVO ALCANZADO!** (${new_target})")
                            else:
                                # pct to go up
                                # (Target - Current) / Current
                                pct_up = ((new_target - current_price) / current_price) * 100
                                st.info(f"Falta subir {pct_up:.2f}%")
                    elif new_target > 0:
                        st.warning("Sin precio actual")
                    else:
                        st.caption("Define un objetivo")

                # 5. Delete
                with c5:
                    if st.button("🗑️", key=f"del_{ticker}"):
                        wishlist.remove_ticker(ticker)
                        st.rerun()
                
                st.markdown("---")
    else:
        st.write("Tu wishlist está vacía.")

with tab5:
    st.header("📚 Bibliografía")
    st.info("Biblioteca de conocimientos del mercado de capitales.")
    
    biblio = Bibliography()
    
    # Add new item
    with st.expander("Agregar Nuevo Recurso"):
        with st.form("new_biblio_item"):
            b_title = st.text_input("Título")
            b_author = st.text_input("Autor")
            b_year = st.number_input("Año", min_value=1900, max_value=2100, step=1, value=2024)
            b_category = st.selectbox("Categoría", ["Libros", "Artículos", "Papers", "Videos", "Otros"])
            b_link = st.text_input("Enlace (Opcional)")
            b_desc = st.text_area("Descripción (Opcional)")
            
            submitted = st.form_submit_button("Guardar Recurso")
            if submitted:
                if b_title and b_author:
                    biblio.add_item(b_title, b_author, b_year, b_category, b_link, b_desc)
                    st.success(f"Agregado: {b_title}")
                    st.rerun()
                else:
                    st.error("Título y Autor son obligatorios.")

    # List items
    items = biblio.get_items()
    if items:
        for item in items:
            with st.container():
                c1, c2 = st.columns([4, 1])
                with c1:
                    st.subheader(f"{item['title']} ({item['year']})")
                    st.markdown(f"**Autor:** {item['author']} | **Categoría:** {item['category']}")
                    if item['description']:
                        st.write(item['description'])
                    if item['link']:
                        st.markdown(f"[🔗 Ver Recurso]({item['link']})")
                with c2:
                    if st.button("🗑️ Eliminar", key=f"del_bib_{item['id']}"):
                        biblio.delete_item(item['id'])
                        st.rerun()
                st.markdown("---")
    else:
        st.info("No hay recursos en la bibliografía aún.")

# Footer
st.markdown("---")
st.markdown("Desarrollado con ❤️ por tu Agente Financiero")
