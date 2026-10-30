//+------------------------------------------------------------------+
//| StudioBars.mq5                                                   |
//| Not a strategy. Run by the studio in the tester (Model=2) to     |
//| export the bars of the tested symbol/period for the chart.       |
//+------------------------------------------------------------------+
#property strict

datetime g_start = 0;

int OnInit()
  {
   g_start = TimeCurrent();
   return INIT_SUCCEEDED;
  }

void OnTick() {}

void OnDeinit(const int reason)
  {
   MqlRates b[];
   const int n = CopyRates(_Symbol, _Period, g_start, TimeCurrent(), b);
   if(n <= 0)
     {
      PrintFormat("StudioBars: CopyRates failed: %d", GetLastError());
      return;
     }
   const int f = FileOpen("studio_bars.csv", FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON, ',');
   if(f == INVALID_HANDLE)
     {
      PrintFormat("StudioBars: cannot open file: %d", GetLastError());
      return;
     }
   FileWrite(f, "time", "open", "high", "low", "close");
   for(int i = 0; i < n; i++)
      FileWrite(f, TimeToString(b[i].time, TIME_DATE|TIME_MINUTES),
                DoubleToString(b[i].open, _Digits), DoubleToString(b[i].high, _Digits),
                DoubleToString(b[i].low, _Digits), DoubleToString(b[i].close, _Digits));
   FileClose(f);
   PrintFormat("StudioBars: wrote %d bars", n);
  }
//+------------------------------------------------------------------+
