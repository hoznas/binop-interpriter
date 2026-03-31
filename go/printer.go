package main

type LogPrinter struct {
	PrintLogs []string
}

func NewLogPrinter() *LogPrinter {
	return &LogPrinter{}
}

func (lp *LogPrinter) Print(msg string) {
	lp.PrintLogs = append(lp.PrintLogs, msg)
}

func (lp *LogPrinter) GetPrintFunction() PrintFunc {
	return func(msg string) {
		lp.Print(msg)
	}
}

func (lp *LogPrinter) GetLogs() []string {
	return lp.PrintLogs
}

func (lp *LogPrinter) GetLastLog() *string {
	if len(lp.PrintLogs) == 0 {
		return nil
	}
	s := lp.PrintLogs[len(lp.PrintLogs)-1]
	return &s
}
