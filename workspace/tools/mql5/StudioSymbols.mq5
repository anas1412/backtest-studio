//+------------------------------------------------------------------+
//| StudioSymbols.mq5                                                |
//| Script, not a strategy. The studio starts the terminal with it   |
//| to list every symbol the broker offers, with its live spread,    |
//| then closes the terminal.                                        |
//+------------------------------------------------------------------+
#property strict

void OnStart()
  {
   // the terminal starts before it is logged in; give it time
   for(int i = 0; i < 60 && !TerminalInfoInteger(TERMINAL_CONNECTED); i++)
      Sleep(500);
   Sleep(2000); // let the symbol list and quotes arrive

   // tab separated: descriptions contain commas
   const int f = FileOpen("studio_symbols.tsv", FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON, '\t');
   if(f == INVALID_HANDLE)
     {
      PrintFormat("StudioSymbols: cannot open file: %d", GetLastError());
      TerminalClose(1);
      return;
     }
   FileWrite(f, "name", "description", "path", "digits", "spread", "connected");
   const bool connected = (bool)TerminalInfoInteger(TERMINAL_CONNECTED);
   const int n = SymbolsTotal(false);
   for(int i = 0; i < n; i++)
     {
      const string s = SymbolName(i, false);
      FileWrite(f, s, SymbolInfoString(s, SYMBOL_DESCRIPTION), SymbolInfoString(s, SYMBOL_PATH),
                IntegerToString(SymbolInfoInteger(s, SYMBOL_DIGITS)),
                IntegerToString(SymbolInfoInteger(s, SYMBOL_SPREAD)),
                connected ? "1" : "0");
     }
   FileClose(f);
   PrintFormat("StudioSymbols: wrote %d symbols", n);
   TerminalClose(0);
  }
//+------------------------------------------------------------------+
