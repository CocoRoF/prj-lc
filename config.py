from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

HOME_HOST = "https://shoppinglive.naver.com"
VIEW_HOST = "https://view.shoppinglive.naver.com"
API_HOST = "https://apis.naver.com/selectiveweb/live_commerce_web"

CSV_ENCODING = "utf-8-sig"

REQUEST_TIMEOUT = 20
REQUEST_MIN_GAP = 0.5
REQUEST_MAX_GAP = 1.5

CATEGORIES_CSV = DATA_DIR / "categories.csv"
EXHIBITIONS_CSV = DATA_DIR / "exhibitions.csv"
BROADCASTS_CSV = DATA_DIR / "broadcasts.csv"
BROADCAST_PRODUCTS_CSV = DATA_DIR / "broadcast_products.csv"
CHANNELS_CSV = DATA_DIR / "channels.csv"
COMMENTS_CSV = DATA_DIR / "comments.csv"

CAPTURE_DIR = DATA_DIR / "_capture"
CAPTURE_DIR.mkdir(exist_ok=True)
