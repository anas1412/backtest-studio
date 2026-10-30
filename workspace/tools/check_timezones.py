"""Compare TimeZones.mqh output (studio_tzcheck.csv) with the IANA tz database.

Usage: python3 check_timezones.py <path to studio_tzcheck.csv>
MQL datetimes are naive seconds; the broker clock is modelled as New York + 7h
(UTC+2 in winter, +3 in US summer), the model TimeZones.mqh is run with.
"""
import csv
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

NY, LON, TOK, SYD = (ZoneInfo(z) for z in ("America/New_York", "Europe/London", "Asia/Tokyo", "Australia/Sydney"))
UTC = timezone.utc


def broker_of(utc: datetime) -> int:
    """Naive broker clock seconds for a UTC instant."""
    off = utc.astimezone(NY).utcoffset() + timedelta(hours=7)
    return int((utc + off).replace(tzinfo=UTC).timestamp())


def session(broker_now: int, zone: ZoneInfo, h: int, m: int) -> int:
    # broker naive -> UTC: try both offsets, keep the consistent one
    for off in (2, 3):
        utc = datetime.fromtimestamp(broker_now - off * 3600, UTC)
        if broker_of(utc) == broker_now:
            break
    day = utc.astimezone(zone).date()
    start = datetime(day.year, day.month, day.day, h, m, tzinfo=zone).astimezone(UTC)
    return broker_of(start)


bad = Counter()
examples: dict[str, list[str]] = {}
rows = 0
with open(sys.argv[1], newline="", encoding="latin1") as fh:
    for r in csv.DictReader(fh):
        rows += 1
        t = datetime.fromtimestamp(int(r["utc"]), UTC)
        checks = {
            "us": r["us"] == "1", "eu": r["eu"] == "1", "au": r["au"] == "1",
            "broker": int(r["broker"]),
        }
        want = {
            "us": t.astimezone(NY).utcoffset() == timedelta(hours=-4),
            "eu": t.astimezone(LON).utcoffset() == timedelta(hours=1),
            "au": t.astimezone(SYD).utcoffset() == timedelta(hours=11),
            "broker": broker_of(t),
        }
        if r["london0800"]:
            b = int(r["broker"])
            for key, zone, h, m in (("london0800", LON, 8, 0), ("ny0930", NY, 9, 30),
                                    ("tokyo0900", TOK, 9, 0), ("sydney0900", SYD, 9, 0)):
                checks[key] = int(r[key])
                want[key] = session(b, zone, h, m)
        for k, v in checks.items():
            if v != want[k]:
                bad[k] += 1
                ex = examples.setdefault(k, [])
                if len(ex) < 3:
                    shown = datetime.fromtimestamp(v, UTC) if k not in ("us", "eu", "au") else v
                    exp = datetime.fromtimestamp(want[k], UTC) if k not in ("us", "eu", "au") else want[k]
                    ex.append(f"{t:%Y-%m-%d %H:%M} UTC  got {shown}  want {exp}")

print(f"{rows} hourly rows checked, 2021-2027")
for k in ("us", "eu", "au", "broker", "london0800", "ny0930", "tokyo0900", "sydney0900"):
    print(f"  {k:11} {'OK' if not bad[k] else f'{bad[k]} mismatches'}")
    for e in examples.get(k, []):
        print(f"      {e}")
