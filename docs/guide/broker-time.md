# Broker time & DST

Everything in the MT5 tester happens in **broker server time**, and that clock is neither yours nor London's. Getting
session times right needs three things:

1. **Your broker's offset.** Many MT5 brokers (most prop firms among them) run UTC+2 in winter and UTC+3 in summer,
   switching on the **US** daylight-saving dates, so their day starts at 17:00 New York. Others switch on EU dates or not
   at all.
2. **The session's own DST.** London follows UK/EU dates, New York follows US dates.
3. **The weeks they disagree.** The US switches about 3 weeks before the UK in March and 1 week after in
   October/November. In those weeks "London 08:00" is a different broker hour than the rest of the year.

## How strategies handle it

The AI never hardcodes session hours in broker time. Strategies use the app's time-zone module, which converts a
session time in its own city to broker time for any date:

```cpp
#include <Studio/TimeZones.mqh>
input int  InpWinterOffset = 2;     // broker hours ahead of UTC in winter
input bool InpFollowsUSDST = true;  // broker switches on US dates (false = EU)

// broker time at which today's London 08:00 session opens
datetime open = SessionStartInBrokerTime(TimeCurrent(), TZ_LONDON, 8, 0,
                                         InpWinterOffset, InpFollowsUSDST);
```

Zones: London, New York, Tokyo, Sydney, UTC. Also `BrokerToUTC()` and `UTCToBroker()`.

## Set it for your broker

The two inputs live under **Advanced** on each strategy:

- **InpWinterOffset:** your broker's UTC offset in winter (look at MT5's Market Watch clock against UTC in January).
- **InpFollowsUSDST:** on if your broker changes its clock on the US dates, off for EU dates.

## Verified, not assumed

The module's session times for London, New York, Tokyo and Sydney were checked hour by hour for 2021 to 2027 against
the IANA time-zone database (the one operating systems use), with a broker clock of UTC+2/+3 on US dates. The check
ships in the workspace: the `TimeZonesCheck` script (in `tools/mql5/`) writes the module's output from MT5, and
`tools/check_timezones.py` compares it with the database (needs Python 3.9+).

`TimeGMT()` and `TimeLocal()` read your computer's clock, not the tested date, so strategies never use them.
