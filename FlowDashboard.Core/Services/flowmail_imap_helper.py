import email
import html
import imaplib
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime


SPOTIFY_LINK_RE = re.compile(r"https://accounts\.spotify\.com/login/ott/music[^\s\"'<>]+", re.I)


def normalize_email(value):
    return str(value or "").strip().lower()


def parse_requested_after(value):
    text = str(value or "").strip()
    if not text:
        return datetime.now(timezone.utc) - timedelta(minutes=20)
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        return datetime.now(timezone.utc) - timedelta(minutes=20)


def decode_header_value(value):
    if not value:
        return ""
    parts = email.header.decode_header(value)
    out = []
    for raw, charset in parts:
        if isinstance(raw, bytes):
            out.append(raw.decode(charset or "utf-8", errors="replace"))
        else:
            out.append(str(raw))
    return "".join(out)


def message_body(msg):
    chunks = []
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            if ctype not in ("text/plain", "text/html"):
                continue
            payload = part.get_payload(decode=True)
            if not payload:
                continue
            charset = part.get_content_charset() or "utf-8"
            chunks.append(payload.decode(charset, errors="replace"))
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            chunks.append(payload.decode(charset, errors="replace"))
    return html.unescape("\n".join(chunks))


def extract_spotify_magic_link(value):
    value = html.unescape(value or "").replace("<wbr>", "").replace("</wbr>", "")
    for match in SPOTIFY_LINK_RE.finditer(value):
        url = match.group(0).replace("&amp;", "&").rstrip(".,)]")
        if "token=" in url.lower() and "passwordtoken=" in url.lower():
            return url
    return ""


def mask_email(value):
    value = normalize_email(value)
    if "@" not in value:
        return "***" if value else ""
    name, domain = value.split("@", 1)
    if len(name) <= 2:
        return "***@" + domain
    return name[:2] + "***@" + domain


def mask_url(value):
    value = str(value or "")
    if not value:
        return ""
    value = re.sub(r"([#&?](?:token|passwordToken)=)[^&]+", r"\1***", value, flags=re.I)
    value = re.sub(r"([#&?]username=)[^&]+", r"\1***", value, flags=re.I)
    return value


def contains_email(value, target_email):
    return target_email in str(value or "").lower()


def score_message(raw_message, target_email, requested_after, require_recent=False):
    msg = email.message_from_bytes(raw_message)
    subject = decode_header_value(msg.get("Subject", ""))
    from_value = decode_header_value(msg.get("From", ""))
    to_value = decode_header_value(msg.get("To", ""))
    body = message_body(msg)
    link = extract_spotify_magic_link(body)
    if not link:
        return {
            "score": 0,
            "subject": subject,
            "from": from_value,
            "to": to_value,
            "hasTargetEmail": contains_email(to_value + "\n" + body, target_email),
            "hasSpotifySender": "spotify" in from_value.lower(),
            "hasSpotifySubject": "spotify" in subject.lower() or "account" in subject.lower() or "login" in subject.lower(),
            "hasLink": False,
        }

    score = 0
    if contains_email(to_value, target_email):
        score += 35
    if contains_email(body, target_email):
        score += 35
    if "spotify" in from_value.lower():
        score += 15
    if "spotify.com" in from_value.lower():
        score += 15
    if "spotify" in subject.lower():
        score += 8
    if "account" in subject.lower() or "login" in subject.lower():
        score += 5
    is_recent = False
    try:
        msg_date = parsedate_to_datetime(msg.get("Date", "")).astimezone(timezone.utc)
        if msg_date >= requested_after - timedelta(minutes=5):
            is_recent = True
            score += 10
    except Exception:
        pass
    if require_recent and not is_recent:
        return {
            "score": 0,
            "subject": subject,
            "from": from_value,
            "to": to_value,
            "hasTargetEmail": contains_email(to_value + "\n" + body, target_email),
            "hasSpotifySender": "spotify" in from_value.lower(),
            "hasSpotifySubject": "spotify" in subject.lower() or "account" in subject.lower() or "login" in subject.lower(),
            "hasLink": True,
        }

    return {
        "score": score,
        "url": link,
        "subject": subject,
        "from": from_value,
        "to": to_value,
        "hasTargetEmail": contains_email(to_value + "\n" + body, target_email),
        "hasSpotifySender": "spotify" in from_value.lower(),
        "hasSpotifySubject": "spotify" in subject.lower() or "account" in subject.lower() or "login" in subject.lower(),
        "hasLink": True,
    }


def connect(email_address, password):
    client = imaplib.IMAP4_SSL("imap.gmail.com", 993)
    client.login(email_address, password)
    return client


def useful_folders(client):
    folders = ["INBOX"]
    try:
        typ, data = client.list()
        if typ == "OK":
            for row in data or []:
                text = row.decode("utf-8", errors="replace") if isinstance(row, bytes) else str(row)
                match = re.search(r' "(?P<name>[^"]+)"$', text)
                if not match:
                    match = re.search(r" (?P<name>\S+)$", text)
                if not match:
                    continue
                name = match.group("name")
                lower = name.lower()
                if any(token in lower for token in ("spam", "junk", "all mail", "todos", "promotions", "promociones")):
                    folders.append(name)
    except Exception:
        pass
    seen = set()
    for folder in folders:
        key = folder.lower()
        if key not in seen:
            seen.add(key)
            yield folder


def probe(payload):
    client = connect(normalize_email(payload.get("email")), str(payload.get("appPassword") or ""))
    try:
        client.select("INBOX", readonly=True)
    finally:
        client.logout()
    return {"ok": True, "message": "Conectado via Python/OpenSSL"}


def search(payload):
    email_address = normalize_email(payload.get("email"))
    password = str(payload.get("appPassword") or "")
    target_email = normalize_email(payload.get("targetEmail"))
    requested_after = parse_requested_after(payload.get("requestedAfterUtc"))
    require_recent = bool(payload.get("requireRecent"))
    since = (requested_after - timedelta(minutes=15)).strftime("%d-%b-%Y")
    best = {"score": 0}

    client = connect(email_address, password)
    try:
        for folder in useful_folders(client):
            try:
                typ, _ = client.select(f'"{folder}"', readonly=True)
                if typ != "OK":
                    typ, _ = client.select(folder, readonly=True)
                if typ != "OK":
                    continue
                typ, data = client.search(None, "SINCE", since)
                if typ != "OK" or not data:
                    continue
                ids = data[0].split()
                for msg_id in reversed(ids[-60:]):
                    typ, msg_data = client.fetch(msg_id, "(RFC822)")
                    if typ != "OK" or not msg_data:
                        continue
                    raw = next((part[1] for part in msg_data if isinstance(part, tuple) and len(part) > 1), None)
                    if not raw:
                        continue
                    candidate = score_message(raw, target_email, requested_after, require_recent)
                    if candidate.get("score", 0) > best.get("score", 0):
                        best = candidate
                    if best.get("score", 0) >= 90:
                        break
            except Exception:
                pass
            if best.get("score", 0) >= 90:
                break
    finally:
        client.logout()

    if best.get("score", 0) <= 0 or not best.get("url"):
        return {"found": False, "message": "No se encontro magic link FlowMail."}
    return {
        "found": best["score"] >= 55,
        "url": best["url"],
        "score": int(best["score"]),
        "subject": best.get("subject", ""),
        "from": best.get("from", ""),
        "message": "Magic link encontrado." if best["score"] >= 55 else "Candidato debil descartado.",
    }


def debug_search(payload):
    email_address = normalize_email(payload.get("email"))
    password = str(payload.get("appPassword") or "")
    target_email = normalize_email(payload.get("targetEmail"))
    requested_after = parse_requested_after(payload.get("requestedAfterUtc"))
    require_recent = bool(payload.get("requireRecent"))
    minutes_back = int(payload.get("minutesBack") or 240)
    if minutes_back < 15:
        minutes_back = 15
    if minutes_back > 1440:
        minutes_back = 1440
    since = (datetime.now(timezone.utc) - timedelta(minutes=minutes_back)).strftime("%d-%b-%Y")

    folders_debug = []
    candidates = []
    best = {"score": 0}
    client = connect(email_address, password)
    try:
        for folder in useful_folders(client):
            folder_info = {"folder": folder, "selected": False, "searched": 0, "errors": []}
            try:
                typ, _ = client.select(f'"{folder}"', readonly=True)
                if typ != "OK":
                    typ, _ = client.select(folder, readonly=True)
                if typ != "OK":
                    folder_info["errors"].append("select failed")
                    folders_debug.append(folder_info)
                    continue
                folder_info["selected"] = True
                typ, data = client.search(None, "SINCE", since)
                if typ != "OK" or not data:
                    folder_info["errors"].append("search empty")
                    folders_debug.append(folder_info)
                    continue
                ids = data[0].split()
                folder_info["searched"] = len(ids)
                for msg_id in reversed(ids[-120:]):
                    typ, msg_data = client.fetch(msg_id, "(RFC822)")
                    if typ != "OK" or not msg_data:
                        continue
                    raw = next((part[1] for part in msg_data if isinstance(part, tuple) and len(part) > 1), None)
                    if not raw:
                        continue
                    candidate = score_message(raw, target_email, requested_after, require_recent)
                    subject = str(candidate.get("subject", ""))
                    from_value = str(candidate.get("from", ""))
                    is_relevant = (
                        candidate.get("score", 0) > 0
                        or "spotify" in from_value.lower()
                        or "spotify" in subject.lower()
                        or "account" in subject.lower()
                        or candidate.get("hasTargetEmail")
                    )
                    if is_relevant:
                        safe = {
                            "folder": folder,
                            "score": int(candidate.get("score", 0) or 0),
                            "subject": subject,
                            "from": from_value,
                            "toMasked": mask_email(candidate.get("to", "")),
                            "targetMasked": mask_email(target_email),
                            "hasTargetEmail": bool(candidate.get("hasTargetEmail")),
                            "hasSpotifySender": bool(candidate.get("hasSpotifySender")),
                            "hasSpotifySubject": bool(candidate.get("hasSpotifySubject")),
                            "hasLink": bool(candidate.get("hasLink")),
                            "urlMasked": mask_url(candidate.get("url", "")),
                        }
                        candidates.append(safe)
                    if candidate.get("score", 0) > best.get("score", 0):
                        best = candidate
            except Exception as exc:
                folder_info["errors"].append(str(exc))
            folders_debug.append(folder_info)
    finally:
        client.logout()

    candidates.sort(key=lambda item: item.get("score", 0), reverse=True)
    return {
        "ok": True,
        "found": bool(best.get("score", 0) >= 55 and best.get("url")),
        "targetEmailMasked": mask_email(target_email),
        "minutesBack": minutes_back,
        "folders": folders_debug,
        "candidates": candidates[:20],
        "best": {
            "score": int(best.get("score", 0) or 0),
            "subject": best.get("subject", ""),
            "from": best.get("from", ""),
            "toMasked": mask_email(best.get("to", "")),
            "hasLink": bool(best.get("url")),
            "urlMasked": mask_url(best.get("url", "")),
        },
        "message": "Diagnostico FlowMail completado.",
    }


def main():
    payload = json.loads(sys.stdin.read() or "{}")
    action = str(payload.get("action") or "").lower()
    if action == "probe":
        result = probe(payload)
    elif action == "search":
        result = search(payload)
    elif action == "debug_search":
        result = debug_search(payload)
    else:
        raise RuntimeError("Accion FlowMail invalida.")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except imaplib.IMAP4.error as exc:
        print(json.dumps({"ok": False, "message": f"Gmail rechazo la conexion IMAP: {exc}"}, ensure_ascii=False))
        sys.exit(2)
    except Exception as exc:
        print(json.dumps({"ok": False, "message": f"FlowMail Python fallo: {exc}"}, ensure_ascii=False))
        sys.exit(1)
