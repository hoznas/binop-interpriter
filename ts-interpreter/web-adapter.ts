import { Evaluator } from './evaluator';

// Capture printed messages so the web UI can display them
const printLogs: string[] = [];
const evaluator = new Evaluator((msg: string) => {
  printLogs.push(String(msg));
});

// Evaluate code and return result, logs and error (if any)
export function evalCode(code: string) {
  printLogs.length = 0;
  try {
    const result = evaluator.eval(code);
    return { result: result.str(), logs: printLogs.slice(), error: null };
  } catch (e: any) {
    return { result: null, logs: printLogs.slice(), error: (e && e.message) || String(e) };
  }
}

// Attach to window for consumption from the single HTML file
declare global {
  interface Window {
    BinOp: any;
  }
}

window.BinOp = {
  evalCode,
};

export default window.BinOp;
