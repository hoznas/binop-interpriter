import { readFileSync } from 'fs';
import { Evaluator } from './evaluator';

if (process.argv.length >= 3) {
  const e = new Evaluator();
  let fileContent = readFileSync(process.argv[2]).toString();
  e.eval(fileContent);
} else {
  console.log('argument file required');
}
