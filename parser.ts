import { IoObject, Message, Num, Str } from './object';
import { isBinOp, isLPar, isRPar, Token } from './tokenizer';

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
  if (op === '=' || op === ':=') return 6;
  if (op === ';') return 7;
  if (op === ',') return 8;
  throw 'unknown BinOp(' + op + ')';
}

export function parse(tokens: Token[]): IoObject {
  const reader = new TokenReader(tokens);
  const result = parseBinOp(reader, 7);
  return result;
}

function parseBinOp(reader: TokenReader, depth: number): IoObject {
  if (depth === -1) {
    return parseFactor(reader);
  } else if (reader.endOfToken()) {
    throw 'parseBinOp()';
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
    throw "parseFactor() syntax error => ')' unmatch";
  } else if (token.type === 'sym') {
    const s = token.value;
    return parseMessage(s, reader);
  } else {
    //token.type === 'binop'
    throw 'parseFactor()';
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
      const args = parseBinOp(reader, 8);
      const m = new Message(undefined, mName, toArray(args));
      reader.drop(')');
      return m;
    }
  } else {
    return new Message(undefined, mName);
  }
}

function parseParents(reader: TokenReader): IoObject {
  const result = parseBinOp(reader, 7);
  reader.drop(')');
  return result;
}
//
function toArray(obj: IoObject): IoObject[] {
  if (obj instanceof Message && isBinOpMessage(obj, ',')) {
    return toArray(obj.target!).concat(obj.args![0]);
  } else {
    return [obj];
  }
}

export function isBinOpMessage(obj: Message, op?: string): boolean {
  return obj.target !== undefined && obj.name === op && obj.args?.length === 1;
}
