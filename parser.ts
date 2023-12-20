import { BoObject, Message, Num, Str } from './object';
import { Token, isBinOp, isLPar, isRPar, isSym } from './tokenizer';

class TokenReader {
  tokens: Token[];
  ptr: number;
  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.ptr = -1;
  }
  next(): Token {
    this.ptr += 1;
    return this.tokens[this.ptr];
  }
  prev(): Token {
    this.ptr -= 1;
    return this.tokens[this.ptr];
  }
  curr(): Token {
    return this.tokens[this.ptr];
  }
  seeNext(n: number = 1): Token {
    return this.tokens[this.ptr + n];
  }
  endOfToken(): boolean {
    return !(this.ptr < this.tokens.length - 1);
  }
  restCount(): number {
    return this.tokens.length - 1 - this.ptr;
  }
  drop(tokenStr: string) {
    const t = this.next();
    if (t.value !== tokenStr)
      throw new Error(`ERROR TokenReader::drop("${tokenStr}")=>"${t.value}"`);
  }
}

const binOpRate = (op: string): number => {
  if (op === '.') return 0;
  if (op === '*' || op === '/' || op === '%') return 1;
  if (op === '+' || op === '-') return 2;
  if (op === '<' || op === '>' || op === '<=' || op === '>=') return 3;
  if (op === '==' || op === '!=') return 4;
  if (op === '&&' || op === '||') return 5;
  if (op === ':=' || op === '=') return 7;
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(op)) return 8;
  if (op === ';') return 9;
  if (op === ',') return 10;
  throw new Error(`ERROR binOpRate() =>unknown BinOp(${op})`);
};

export const parse = (tokens: Token[]): BoObject => {
  const reader = new TokenReader(tokens);
  // parser starts (binOpRate() === 9)
  // "," operator does not exists only in the argument list.
  // not in top level program
  const result = parseBinOp(reader, 9);
  return result;
};

const parseBinOp = (reader: TokenReader, depth: number): BoObject => {
  if (depth === -1) {
    return parseFactor(reader);
  } else if (reader.endOfToken()) {
    throw new Error('ERROR parseBinOp(end of code)');
  } else {
    const result = parseBinOp(reader, depth - 1);
    if (reader.endOfToken()) {
      return result;
    } else {
      const next = reader.seeNext();
      if (isRPar(next)) {
        return result;
      } else {
        if (isBinOp(next) || (isSym(next) && binOpRate(next.value) === depth)) {
          return parseBinOp2(reader, result, depth);
        }
      }
    }
    return result;
  }
};

const parseBinOp2 = (
  reader: TokenReader,
  lhs: any,
  depth: number
): BoObject => {
  let result = lhs;
  while (true) {
    if (reader.endOfToken()) {
      return result;
    } else if (isRPar(reader.seeNext())) {
      return result;
    } else if (binOpRate(reader.seeNext()?.value) == depth) {
      const op = reader.next();
      const code2 = parseBinOp(reader, depth - 1);
      result = new Message(result, op.value, [code2]);
    } else {
      return result;
    }
  }
};

const parseFactor = (reader: TokenReader): BoObject => {
  const token = reader.next();
  if (token.type === 'num') {
    return new Num(Number(token.value));
  } else if (token.type === 'str') {
    return new Str(token.value);
  } else if (token.type === '(') {
    return parseParents(reader);
  } else if (token.type === 'sym') {
    const s = token.value;
    return parseMessage(s, reader);
  } else if (token.type === ')') {
    throw new Error("ERROR parseFactor() syntax error => ')' unmatch");
  } else {
    //token.type === 'binop'
    throw new Error(`ERROR parseFactor() => arg=BinOp(${token.value})`);
  }
};

const parseMessage = (slotName: string, reader: TokenReader): Message => {
  if (reader.restCount() >= 2 && isLPar(reader.seeNext(1))) {
    const args = parseArgParents(reader);
    return new Message(undefined, slotName, args);
  } else {
    return new Message(undefined, slotName);
  }
};

const parseArgParents = (reader: TokenReader): BoObject[] => {
  reader.drop('(');
  if (isRPar(reader.seeNext())) {
    // no argument
    reader.drop(')');
    return [];
  } else {
    // some argument(s)
    const args = toArray(parseBinOp(reader, 10));
    reader.drop(')');
    return args;
  }
};

const parseParents = (reader: TokenReader): BoObject => {
  const result = parseBinOp(reader, 9);
  reader.drop(')');
  return result;
};

const toArray = (obj: BoObject): BoObject[] => {
  if (obj instanceof Message && isBinOpMessage(obj, ',')) {
    return toArray(obj.receiver!).concat(obj.args![0]);
  } else {
    return [obj];
  }
};

const isBinOpMessage = (obj: Message, op: string): boolean => {
  if (obj.receiver !== undefined && obj.args?.length === 1) {
    if (op) return obj.slotName === op;
    else true;
  }
  return false;
};
