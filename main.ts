import { readFileSync } from 'fs';
import { Evaluator } from './evaluator';

const e = new Evaluator();
let fileContent = readFileSync('./sample.bo').toString();

e.eval(fileContent);
