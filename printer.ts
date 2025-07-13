export class LogPrinter {
  printLogs: string[] = [];

  print(msg: string): void {
    this.printLogs.push(msg);
  }
  getPrintFunction = () => {
    return (msg: string) => this.print(msg);
  };
  getLogs(): string[] {
    return this.printLogs;
  }
  getLastLogs(): string | undefined {
    if (this.printLogs.length === 0) {
      return undefined;
    }
    return this.printLogs[this.printLogs.length - 1];
  }
}
