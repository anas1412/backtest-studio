//+------------------------------------------------------------------+
//| TimeZonesCheck.mq5                                               |
//| Script. Dumps TimeZones.mqh answers for every hour 2021-2027 so  |
//| tools/check_timezones.py can compare them with the IANA tz       |
//| database. Broker model under test: winter UTC+2, US DST dates.   |
//+------------------------------------------------------------------+
#property strict
#include <Studio/TimeZones.mqh>

void OnStart()
  {
   const int f = FileOpen("studio_tzcheck.csv", FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON, ',');
   if(f == INVALID_HANDLE)
     {
      TerminalClose(1);
      return;
     }
   FileWrite(f, "utc", "us", "eu", "au", "broker", "london0800", "ny0930", "tokyo0900", "sydney0900");
   for(datetime t = D'2021.01.01'; t < D'2028.01.01'; t += 3600)
     {
      const datetime broker = UTCToBroker(t, 2, true);
      MqlDateTime b;
      TimeToStruct(broker, b);
      // session answers once a day, asked at broker noon
      string lon = "", ny = "", tok = "", syd = "";
      if(b.hour == 12)
        {
         lon = IntegerToString((long)SessionStartInBrokerTime(broker, TZ_LONDON,   8,  0, 2, true));
         ny  = IntegerToString((long)SessionStartInBrokerTime(broker, TZ_NEWYORK,  9, 30, 2, true));
         tok = IntegerToString((long)SessionStartInBrokerTime(broker, TZ_TOKYO,    9,  0, 2, true));
         syd = IntegerToString((long)SessionStartInBrokerTime(broker, TZ_SYDNEY,   9,  0, 2, true));
        }
      FileWrite(f, IntegerToString((long)t), IsUSDST(t) ? "1" : "0", IsEUDST(t) ? "1" : "0",
                IsAUDST(t) ? "1" : "0", IntegerToString((long)broker), lon, ny, tok, syd);
     }
   FileClose(f);
   TerminalClose(0);
  }
//+------------------------------------------------------------------+
