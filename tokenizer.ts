export type Token = {
  type: TokenType;
  value: string;
};
export type TokenType = '(' | ')' | 'sym' | 'num' | 'str' | 'binop';

const binop = /^(<=|>=|==|!=|:=|&&|\|\||[.*%+\-\/<>=,])/m; // Binary Operator
const terminator = /^(\n|;)/m;
const whiteSpace = /^([ \t])/m;
const num = /^(\d+)/m;
const str = /^("(?:[^"]*)")/m;
const sym = /^([a-zA-Z_][a-zA-Z0-9_]*)/m;
const lpar = /^(\()/m;
const rpar = /^(\))/m;

export const tokenize = (code: string): Token[] => {
  const processedCode = preprocess(code);
  const result = makeTokenList(processedCode);
  return filterSemicolon(result);
};

const preprocess = (code: string): string => {
  return code.replace(/(\r\n|\r|\n|;)+/g, ';');
};

const makeTokenList = (code: string, result: Token[] = []): Token[] => {
  if (code.length > 0) {
    const [token, restCode] = getToken(code);
    if (token) {
      result.push(token);
    }
    return makeTokenList(restCode, result);
  } else {
    return filterSemicolon(result);
  }
};

const getToken = (code: string): [Token | false, string] => {
  //console.log(`getToken(${code})`)
  let match: RegExpMatchArray | null;
  let token: Token | false;
  if ((match = code.match(num))) {
    token = { type: 'num', value: match![1] };
  } else if ((match = code.match(str))) {
    const temp = match![1];
    token = { type: 'str', value: temp.substring(1, temp.length - 1) };
  } else if ((match = code.match(lpar))) {
    token = { type: '(', value: match![1] };
  } else if ((match = code.match(rpar))) {
    token = { type: ')', value: match![1] };
  } else if ((match = code.match(binop))) {
    token = { type: 'binop', value: match![1] };
  } else if ((match = code.match(terminator))) {
    token = { type: 'binop', value: ';' };
  } else if ((match = code.match(whiteSpace))) {
    token = false;
  } else if ((match = code.match(sym))) {
    token = { type: 'sym', value: match![1] };
  } else {
    throw new Error(`ERROR getToken(${code})`);
  }
  let usedLen;
  if (token) {
    usedLen =
      token.type === 'str' ? token.value.length + 2 : token.value.length;
  } else {
    usedLen = 1; // white space
  }
  const rest = code.substring(usedLen, code.length);
  return [token, rest];
};

const filterSemicolon = (tokens: Token[]): Token[] => {
  // "; ; abc.xyz();;123.print();;" => "abc.xyz();123.print();;"
  while (tokens.length > 1 && isTerminator(tokens[0])) {
    tokens.shift();
  }
  // "abc.xyz();123.print();;" => "abc.xyz();123.print()"
  while (tokens.length > 1 && isTerminator(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return filter2(filter1(tokens));
};

const filter1 = (tokens: Token[]): Token[] => {
  const result: Token[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    if (isTerminator(tokens[i]) && isTerminator(tokens[i + 1])) {
      // do nothing
      // ;; => ;
    } else if (isTerminator(tokens[i]) && isRPar(tokens[i + 1])) {
      // do nothing
      // ;) => )
    } else if (isTerminator(tokens[i]) && isBinOp(tokens[i + 1])) {
      // do nothing
      // ;+ => +
    } else {
      result.push(tokens[i]);
    }
  }
  result.push(tokens[tokens.length - 1]!); // last one
  return result;
};

const filter2 = (tokens: Token[]): Token[] => {
  const result: Token[] = [];
  for (let i = 1; i < tokens.length; i++) {
    if (isLPar(tokens[i - 1]) && isTerminator(tokens[i])) {
      // do nothing
      // (; => (
    } else if (isBinOp(tokens[i - 1]) && isTerminator(tokens[i])) {
      // do nothing
      // +; => +
    } else {
      result.push(tokens[i]);
    }
  }
  result.unshift(tokens[0]); // first one
  return result;
};

export const isTerminator = (t: Token) => {
  return t.type === 'binop' && (t.value === ';' || t.value === '\n');
};

export const isLPar = (t: Token) => {
  return t.type === '(';
};

export const isRPar = (t: Token) => {
  return t.type === ')';
};

export const isBinOp = (t: Token) => {
  return t.type === 'binop';
};

export const isSym = (t: Token) => {
  return t.type === 'sym';
};
