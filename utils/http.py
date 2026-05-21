import random
import time

import requests

from config import REQUEST_MAX_GAP, REQUEST_MIN_GAP, REQUEST_TIMEOUT, USER_AGENT

DEFAULT_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def new_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(DEFAULT_HEADERS)
    return s


def polite_sleep() -> None:
    time.sleep(random.uniform(REQUEST_MIN_GAP, REQUEST_MAX_GAP))


def get_html(session: requests.Session, url: str, referer: str | None = None) -> str:
    headers = {}
    if referer:
        headers["Referer"] = referer
    r = session.get(url, headers=headers, timeout=REQUEST_TIMEOUT, allow_redirects=True)
    r.raise_for_status()
    return r.text
