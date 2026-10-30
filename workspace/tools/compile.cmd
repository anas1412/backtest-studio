@echo off
rem Compile strategies/<name>/<name>.mq5 with MetaEditor.
rem Windows twin of compile.sh for agents that use cmd or PowerShell.
"%STUDIO_BIN%" cli compile %*
