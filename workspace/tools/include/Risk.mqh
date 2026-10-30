//+------------------------------------------------------------------+
//| Risk.mqh  —  #include <Studio/Risk.mqh>                          |
//|                                                                  |
//| Position sizing and account rules shared by every strategy.      |
//| The rules are generic: any prop firm (or none) is just a set of  |
//| these values. Daily loss can be a % of the account size or of    |
//| the day-start value (balance, equity or the higher of the two),  |
//| with its own reset hour; max loss can be static or trailing.     |
//|                                                                  |
//| In the Strategy Tester it also writes one line per day           |
//| (studio_daily.csv) so the studio can check the rules afterwards, |
//| floating losses included.                                        |
//|                                                                  |
//| Use from an EA:                                                  |
//|   OnInit:   RiskInit(InpMagic);                                  |
//|   OnTick:   if(!RiskOnTick()) return;   // before opening trades |
//|   sizing:   double lots = RiskLots(_Symbol, ORDER_TYPE_BUY,      |
//|                                    entry, stopLoss);             |
//|             if(lots <= 0) return;       // stop too wide/no stop |
//|   OnDeinit: RiskDeinit();                                        |
//+------------------------------------------------------------------+
#property strict
#include <Trade\Trade.mqh>

enum ENUM_RISK_MODE
  {
   RISK_PERCENT = 0, // % of balance per trade
   RISK_MONEY   = 1, // Fixed money per trade
   RISK_LOTS    = 2  // Fixed lots
  };

enum ENUM_DAILY_OF
  {
   DAILY_OF_ACCOUNT = 0, // % of account size
   DAILY_OF_START   = 1  // % of the day-start value
  };

enum ENUM_DAY_START
  {
   START_BALANCE = 0, // Balance
   START_EQUITY  = 1, // Equity
   START_HIGHER  = 2  // Higher of balance and equity
  };

enum ENUM_MAXLOSS_TYPE
  {
   MAXLOSS_STATIC     = 0, // Static: from account size
   MAXLOSS_TRAILING   = 1, // Trailing: from highest equity
   MAXLOSS_TRAIL_LOCK = 2  // Trailing until it reaches account size
  };

input group "Risk & rules"
input ENUM_RISK_MODE    InpRiskMode       = RISK_PERCENT;     // Position size
input double            InpRiskPercent    = 1.0;              // Risk per trade, % of balance
input double            InpRiskMoney      = 100;              // Risk per trade, money
input double            InpFixedLots      = 0.01;             // Fixed lots
input double            InpAccountSize    = 0;                // Account size (0 = balance at start)
input double            InpDailyLossPct   = 0;                // Daily loss limit, % (0 = off)
input ENUM_DAILY_OF     InpDailyLossOf    = DAILY_OF_START;   // Daily limit is a % of
input ENUM_DAY_START    InpDayStartValue  = START_HIGHER;     // Day-start value
input int               InpDayResetHour   = 0;                // Day resets at, broker hour
input double            InpMaxLossPct     = 0;                // Max loss limit, % (0 = off)
input ENUM_MAXLOSS_TYPE InpMaxLossType    = MAXLOSS_STATIC;   // Max loss type
input double            InpLimitBuffer    = 20;               // Stop trading this close to a limit, % of it
input bool              InpCloseAtLimit   = true;             // Close positions when stopping at a limit
input double            InpProfitTargetPct = 0;               // Profit target, % (0 = none)
input bool              InpStopAtTarget   = false;            // Stop trading once the target is reached
input int               InpMaxTradesPerDay = 0;               // Max new trades per day (0 = no limit)

CTrade   g_riskTrade;
ulong    g_riskMagic   = 0;
double   g_riskSize    = 0;     // account size the % limits refer to
double   g_peakEquity  = 0;     // high-water mark for trailing max loss
long     g_dayIndex    = -1;    // current rules day
datetime g_dayStart    = 0;
double   g_dayStartBal = 0, g_dayStartEq = 0, g_dayMinEq = 0, g_dayMaxEq = 0;
bool     g_dayBlocked  = false; // daily limit buffer reached: no new trades today
bool     g_halted      = false; // max loss or target: no new trades at all
int      g_logFile     = INVALID_HANDLE;

double RiskEquity()  { return AccountInfoDouble(ACCOUNT_EQUITY); }
double RiskBalance() { return AccountInfoDouble(ACCOUNT_BALANCE); }

double RiskDayStart()
  {
   return InpDayStartValue == START_BALANCE ? g_dayStartBal
        : InpDayStartValue == START_EQUITY  ? g_dayStartEq
        : MathMax(g_dayStartBal, g_dayStartEq);
  }

// How much may be lost today.
double RiskDailyAmount()
  {
   const double base = InpDailyLossOf == DAILY_OF_ACCOUNT ? g_riskSize : RiskDayStart();
   return base * InpDailyLossPct / 100.0;
  }

// Equity the account may not fall to today, or -1 when the rule is off.
double RiskDailyFloor()
  {
   if(InpDailyLossPct <= 0) return -1;
   return RiskDayStart() - RiskDailyAmount();
  }

double RiskMaxFloor()
  {
   if(InpMaxLossPct <= 0) return -1;
   const double amount = g_riskSize * InpMaxLossPct / 100.0;
   if(InpMaxLossType == MAXLOSS_STATIC)   return g_riskSize - amount;
   if(InpMaxLossType == MAXLOSS_TRAILING) return g_peakEquity - amount;
   return MathMin(g_peakEquity - amount, g_riskSize);
  }

void RiskCloseOwn()
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      const ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionGetInteger(POSITION_MAGIC) == (long)g_riskMagic)
         g_riskTrade.PositionClose(ticket);
     }
  }

void RiskWriteDay()
  {
   if(g_logFile == INVALID_HANDLE || g_dayIndex < 0) return;
   int trades = 0;
   if(HistorySelect(g_dayStart, TimeCurrent()))
      for(int i = HistoryDealsTotal() - 1; i >= 0; i--)
        {
         const ulong d = HistoryDealGetTicket(i);
         if(HistoryDealGetInteger(d, DEAL_ENTRY) == DEAL_ENTRY_IN) trades++;
        }
   FileWrite(g_logFile, TimeToString(g_dayStart, TIME_DATE), DoubleToString(g_dayStartBal, 2),
             DoubleToString(g_dayStartEq, 2), DoubleToString(g_dayMinEq, 2), DoubleToString(g_dayMaxEq, 2),
             DoubleToString(RiskBalance(), 2), DoubleToString(RiskEquity(), 2), IntegerToString(trades));
  }

void RiskRollDay()
  {
   const datetime now = TimeCurrent();
   const long day = (long)((now - InpDayResetHour * 3600) / 86400);
   if(day == g_dayIndex) return;
   RiskWriteDay();
   g_dayIndex    = day;
   g_dayStart    = (datetime)(day * 86400 + InpDayResetHour * 3600);
   g_dayStartBal = RiskBalance();
   g_dayStartEq  = RiskEquity();
   g_dayMinEq    = g_dayStartEq;
   g_dayMaxEq    = g_dayStartEq;
   g_dayBlocked  = false;
  }

void RiskInit(const ulong magic)
  {
   g_riskMagic  = magic;
   g_riskTrade.SetExpertMagicNumber(magic);
   g_riskSize   = InpAccountSize > 0 ? InpAccountSize : RiskBalance();
   g_peakEquity = MathMax(RiskEquity(), g_riskSize);
   if(MQLInfoInteger(MQL_TESTER))
     {
      g_logFile = FileOpen("studio_daily.csv", FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON|FILE_SHARE_READ, ',');
      if(g_logFile != INVALID_HANDLE)
        {
         // the rules this run used, so the check needs nothing else
         FileWrite(g_logFile, "#rules", DoubleToString(g_riskSize, 2), DoubleToString(InpDailyLossPct, 4),
                   IntegerToString(InpDailyLossOf), IntegerToString(InpDayStartValue), IntegerToString(InpDayResetHour),
                   DoubleToString(InpMaxLossPct, 4), IntegerToString(InpMaxLossType), DoubleToString(InpProfitTargetPct, 4));
         FileWrite(g_logFile, "day", "start_balance", "start_equity", "min_equity", "max_equity", "end_balance", "end_equity", "trades");
        }
     }
   RiskRollDay();
  }

void RiskDeinit()
  {
   RiskWriteDay();
   if(g_logFile != INVALID_HANDLE) FileClose(g_logFile);
   g_logFile = INVALID_HANDLE;
  }

// Call at the top of OnTick. Tracks equity, enforces the limits, and says
// whether new trades may be opened right now.
bool RiskOnTick()
  {
   RiskRollDay();
   const double eq = RiskEquity();
   g_dayMinEq   = MathMin(g_dayMinEq, eq);
   g_dayMaxEq   = MathMax(g_dayMaxEq, eq);
   g_peakEquity = MathMax(g_peakEquity, eq);

   const double daily = RiskDailyFloor();
   if(daily >= 0 && !g_dayBlocked)
     {
      const double room = RiskDailyAmount() * InpLimitBuffer / 100.0;
      if(eq <= daily + room)
        {
         g_dayBlocked = true;
         PrintFormat("Risk: daily loss buffer reached (equity %.2f, limit %.2f), no new trades today", eq, daily);
         if(InpCloseAtLimit) RiskCloseOwn();
        }
     }
   const double maxFloor = RiskMaxFloor();
   if(maxFloor >= 0 && !g_halted)
     {
      const double room = g_riskSize * InpMaxLossPct / 100.0 * InpLimitBuffer / 100.0;
      if(eq <= maxFloor + room)
        {
         g_halted = true;
         PrintFormat("Risk: max loss buffer reached (equity %.2f, limit %.2f), trading stopped", eq, maxFloor);
         if(InpCloseAtLimit) RiskCloseOwn();
        }
     }
   if(InpStopAtTarget && InpProfitTargetPct > 0 && !g_halted && eq >= g_riskSize * (1 + InpProfitTargetPct / 100.0))
     {
      g_halted = true;
      PrintFormat("Risk: profit target reached (equity %.2f), trading stopped", eq);
     }
   if(g_dayBlocked || g_halted) return false;

   if(InpMaxTradesPerDay > 0 && HistorySelect(g_dayStart, TimeCurrent()))
     {
      int opened = 0;
      for(int i = HistoryDealsTotal() - 1; i >= 0; i--)
        {
         const ulong d = HistoryDealGetTicket(i);
         if(HistoryDealGetInteger(d, DEAL_MAGIC) == (long)g_riskMagic && HistoryDealGetInteger(d, DEAL_ENTRY) == DEAL_ENTRY_IN)
            opened++;
        }
      if(opened >= InpMaxTradesPerDay) return false;
     }
   return true;
  }

// Lots for a trade from entry to stop loss under the chosen risk mode.
// 0 means don't trade: no stop, or even the minimum lot risks too much.
double RiskLots(const string symbol, const ENUM_ORDER_TYPE type, const double entry, const double stopLoss)
  {
   const double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
   const double vmin = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   const double vmax = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   if(InpRiskMode == RISK_LOTS)
      return MathMax(vmin, MathMin(vmax, MathFloor(InpFixedLots / step) * step));
   if(stopLoss <= 0 || stopLoss == entry)
     {
      Print("Risk: no stop loss, can't size by risk");
      return 0;
     }
   double perLot = 0;
   if(!OrderCalcProfit(type, symbol, 1.0, entry, stopLoss, perLot) || perLot >= 0)
     {
      Print("Risk: stop loss is on the wrong side of the entry");
      return 0;
     }
   const double money = InpRiskMode == RISK_PERCENT ? RiskBalance() * InpRiskPercent / 100.0 : InpRiskMoney;
   const double lots  = MathFloor(money / -perLot / step) * step;
   if(lots < vmin)
     {
      PrintFormat("Risk: the minimum lot (%.2f) would risk more than %.2f", vmin, money);
      return 0;
     }
   return MathMin(lots, vmax);
  }
//+------------------------------------------------------------------+
