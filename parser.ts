import { IoObject, Message, Num, Str } from './object';
import { isBinOp, isLPar, isRPar, isSym, Token } from './tokenizer';

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
      throw `ERROR TokenReader::drop("${tokenStr}") => curr=="${t.value}"`;
  }
}

function binOpRate(op: string): number {
  if (op === '.') return 0;
  if (op === '*' || op === '/' || op === '%') return 1;
  if (op === '+' || op === '-') return 2;
  if (op === '<' || op === '>' || op === '<=' || op === '>=') return 3;
  if (op === '==' || op === '!=') return 4;
  if (op === '&&' || op === '||') return 5;
  if (op === '=' || op === ':=') return 7;
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(op)) return 8;
  if (op === ';') return 9;
  if (op === ',') return 10;
  throw `ERROR binOpRate() =>unknown BinOp(${op})`;
}

export function parse(tokens: Token[]): IoObject {
  const reader = new TokenReader(tokens);
  const result = parseBinOp(reader, 9);
  return result;
}

function parseBinOp(reader: TokenReader, depth: number): IoObject {
  if (depth === -1) {
    return parseFactor(reader);
  } else if (reader.endOfToken()) {
    throw 'ERROR parseBinOp(end of code) ';
  } else {
    const result = parseBinOp(reader, depth - 1);
    if (reader.endOfToken()) {
      return result;
    } else {
      const next = reader.seeNext();
      if (isRPar(next)) {
        return result;
      } else {
        if (isBinOp(next) && binOpRate(next.value) === depth) {
          return parseBinOp2(reader, result, depth);
        } else if (isSym(next) && binOpRate(next.value) === depth) {
          return parseBinOp2(reader, result, depth);
        }
      }
    }
    return result;
  }
}

function parseBinOp2(reader: TokenReader, lhs: any, depth: number): IoObject {
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
}

function parseFactor(reader: TokenReader): IoObject {
  const token = reader.next();
  if (token.type === 'num') {
    return new Num(Number(token.value));
  } else if (token.type === 'str') {
    return new Str(token.value);
  } else if (token.type === '(') {
    return parseParents(reader);
  } else if (token.type === ')') {
    throw "ERROR parseFactor() syntax error => ')' unmatch";
  } else if (token.type === 'sym') {
    const s = token.value;
    return parseMessage(s, reader);
  } else {
    //token.type === 'binop'
    throw 'ERROR parseFactor() => unknown operator';
  }
}

function parseMessage(mName: string, reader: TokenReader): Message {
  if (reader.restCount() < 2) {
    return new Message(undefined, mName);
  } else if (isLPar(reader.seeNext())) {
    if (isRPar(reader.seeNext(2))) {
      // no argument
      const m = new Message(undefined, mName, []);
      reader.drop('(');
      reader.drop(')');
      return m;
    } else {
      // some argument(s)
      reader.next(); // drop "("
      const args = parseBinOp(reader, 10);
      const m = new Message(undefined, mName, toArray(args));
      reader.drop(')');
      return m;
    }
  } else {
    return new Message(undefined, mName);
  }
}

function parseParents(reader: TokenReader): IoObject {
  const result = parseBinOp(reader, 9);
  reader.drop(')');
  return result;
}

function toArray(obj: IoObject): IoObject[] {
  if (obj instanceof Message && isBinOpMessage(obj, ',')) {
    return toArray(obj.target!).concat(obj.args![0]);
  } else {
    return [obj];
  }
}

export function isBinOpMessage(obj: Message, op?: string): boolean {
  return (
    obj.target !== undefined && obj.slotName === op && obj.args?.length === 1
  );
}
