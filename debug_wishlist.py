from src.database import WishlistItem

def check_wishlist():
    items = WishlistItem.select()
    print(f"Found {len(items)} items in Wishlist:")
    for item in items:
        print(f"- {item.ticker}: Target={item.target_price} (Type: {type(item.target_price)})")

if __name__ == "__main__":
    check_wishlist()
