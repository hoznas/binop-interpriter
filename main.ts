import { readFileSync } from 'fs';
import { Evaluator } from './evaluator';

if (process.argv.length >= 3) {
  const e = new Evaluator();
  let fileContent = readFileSync('./sample.bo').toString();
  e.eval(fileContent);
} else {
  console.log('argument file required');
}
