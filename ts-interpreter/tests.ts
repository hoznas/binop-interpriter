import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Evaluator } from './evaluator';
import { Memory } from './memory';
import { Num } from './object';
import { parse } from './parser';
import { tokenize } from './tokenizer';
import { LogPrinter } from './printer';

describe('Tokenizer', () => {
  const tests: [string, string][] = [
    ['123', '123'],
    ['abc', 'abc'],
    ['"abc def"', 'abc def'],
    [`"abc "${'\n'}"def"`, 'abc |;|def'],
    [';;abc;def;;zzz;;', 'abc|;|def|;|zzz'],
    [
      ';;;abc.f(;c;,;;a;;b;;)  ;;;;;  def(;;"a b c";) ; ; xxx; zzz ;;  ;',
      'abc|.|f|(|c|,|a|;|b|)|;|def|(|a b c|)|;|xxx|;|zzz',
    ],
  ];
  
  for (const [code, expected] of tests) {
    test(`should tokenize: ${code.substring(0, 20)}...`, () => {
      const result = tokenize(code);
      const result_str = result.map((e) => e.value).join('|');
      assert.strictEqual(result_str, expected);
    });
  }
});

describe('Parser', () => {
  const tests: [string, string][] = [
    ['123', '123'],
    ['"abc def"', '"abc def"'],
    ['abc', 'abc'],
    ['1+2', '1.+(2)'],
    ['1+2*3', '1.+(2.*(3))'],
    ['(1+2)*3', '1.+(2).*(3)'],
    ['1.print', '1.print'],
    ['1 op 2', '1.op(2)'],
    ['1.print;2.print();', '1.print.;(2.print())'],
    ['print;print()\nprint(1+2)', 'print.;(print()).;(print(1.+(2)))'],
    [
      'i:=0;while(i<10,x:=i*2;x.println)',
      'i.:=(0).;(while(i.<(10), x.:=(i.*(2)).;(x.println)))',
    ],
    ['print', 'print'],
    ['print()', 'print()'],
    ['print(1)', 'print(1)'],
    ['print(1,2)', 'print(1, 2)'],
    ['Object.clone().clone()', 'Object.clone().clone()'],
    ['obj func arg', 'obj.func(arg)'],
  ];
  
  for (const [code, expected] of tests) {
    test(`should parse: ${code}`, () => {
      const tokens = tokenize(code);
      const exp = parse(tokens);
      const result_str = exp.str();
      assert.strictEqual(result_str, expected);
    });
  }
});

describe('Memory (Scope)', () => {
  test('should define and get a variable in the same scope', () => {
    const env = new Memory();
    const result = env.define('x', new Num(42));
    assert.strictEqual(result?.str(), '42');
    assert.strictEqual(env.get('x')?.str(), '42');
  });

  test('should return null when defining a variable twice', () => {
    const env = new Memory();
    env.define('x', new Num(1));
    const result = env.define('x', new Num(2));
    assert.strictEqual(result, null);
    assert.strictEqual(env.get('x')?.str(), '1');
  });

  test('should get undefined for non-existent variable', () => {
    const env = new Memory();
    assert.strictEqual(env.get('nonexistent'), undefined);
  });

  test('should update an existing variable', () => {
    const env = new Memory();
    env.define('x', new Num(1));
    const result = env.update('x', new Num(2));
    assert.strictEqual(result?.str(), '2');
    assert.strictEqual(env.get('x')?.str(), '2');
  });

  test('should return null when updating non-existent variable', () => {
    const env = new Memory();
    const result = env.update('nonexistent', new Num(1));
    assert.strictEqual(result, null);
  });

  test('should get variable from parent scope', () => {
    const parent = new Memory();
    const child = parent.subMemory();
    parent.define('x', new Num(10));
    assert.strictEqual(child.get('x')?.str(), '10');
  });

  test('should shadow parent variable in child scope', () => {
    const parent = new Memory();
    const child = parent.subMemory();
    parent.define('x', new Num(10));
    child.define('x', new Num(20));
    assert.strictEqual(parent.get('x')?.str(), '10');
    assert.strictEqual(child.get('x')?.str(), '20');
  });

  test('should update parent variable from child scope', () => {
    const parent = new Memory();
    const child = parent.subMemory();
    parent.define('x', new Num(10));
    child.update('x', new Num(99));
    assert.strictEqual(parent.get('x')?.str(), '99');
    assert.strictEqual(child.get('x')?.str(), '99');
  });

  test('should update only the nearest scope when shadowed', () => {
    const parent = new Memory();
    const child = parent.subMemory();
    parent.define('x', new Num(10));
    child.define('x', new Num(20));
    child.update('x', new Num(30));
    assert.strictEqual(parent.get('x')?.str(), '10');
    assert.strictEqual(child.get('x')?.str(), '30');
  });

  test('should work with multi-level scope chain', () => {
    const global = new Memory();
    const middle = global.subMemory();
    const local = middle.subMemory();
    
    global.define('a', new Num(1));
    middle.define('b', new Num(2));
    local.define('c', new Num(3));
    
    assert.strictEqual(local.get('a')?.str(), '1');
    assert.strictEqual(local.get('b')?.str(), '2');
    assert.strictEqual(local.get('c')?.str(), '3');
    assert.strictEqual(middle.get('a')?.str(), '1');
    assert.strictEqual(middle.get('c'), undefined);
  });

  test('should force define (overwrite existing variable)', () => {
    const env = new Memory();
    env.define('x', new Num(1));
    const result = env.defineForce('x', new Num(2));
    assert.strictEqual(result.str(), '2');
    assert.strictEqual(env.get('x')?.str(), '2');
  });
});

describe('Evaluator', () => {
  describe('Literals', () => {
    test('should evaluate number literal', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('123').str(), '123');
    });

    test('should evaluate string literal', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('"abc def"').str(), '"abc def"');
    });
  });

  describe('Arithmetic operations', () => {
    test('should evaluate addition and multiplication with precedence', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('1+2*3').str(), '7');
    });

    test('should evaluate parenthesized expression', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('(1+2)*3').str(), '9');
      assert.strictEqual(e.eval('(1+2)').str(), '3');
    });

    test('should concatenate strings', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('"abc" + "def"').str(), '"abcdef"');
    });

    test('should convert number to string when concatenating', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('"abc" + 123').str(), '"abc123"');
    });

    test('should convert string to number when adding', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('123 + "123"').str(), '246');
    });
  });

  describe('String operations (car/cdr style)', () => {
    test('should get first character with /', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('"abc" / 1').str(), '"a"');
    });

    test('should get rest of string with %', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('"abc" % 1').str(), '"bc"');
    });
  });

  describe('Comparison operations', () => {
    test('should compare numbers', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('2>1').str(), '1');
      assert.strictEqual(e.eval('1 + 1 == 3').str(), 'nil');
    });
  });

  describe('Logical operations', () => {
    test('should evaluate && with short-circuit', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('1 && nil').str(), 'nil');
      assert.strictEqual(e.eval('nil && nil').str(), 'nil');
      assert.strictEqual(e.eval('nil && 1').str(), 'nil');
      assert.strictEqual(e.eval('1 && 1').str(), '1');
    });

    test('should evaluate || with short-circuit', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('nil || nil').str(), 'nil');
      assert.strictEqual(e.eval('1 || nil').str(), '1');
      assert.strictEqual(e.eval('nil || 1').str(), '1');
      assert.strictEqual(e.eval('1 || 1').str(), '1');
    });
  });

  describe('Variables', () => {
    test('should define and use variable with :=', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('a := 5; a*4').str(), '20');
    });

    test('should update variable with =', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('b := 5; b=b+1; b').str(), '6');
    });
  });

  describe('Sequence operator', () => {
    test('should evaluate sequence and return last value', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('1 + 1;2*4').str(), '8');
    });
  });

  describe('Control flow (if)', () => {
    test('should execute true branch when condition is truthy', () => {
      const e = new Evaluator();
      assert.strictEqual(
        e.eval('(2>1).if(r:="big",r:="small");r').str(),
        '"big"'
      );
    });

    test('should execute false branch when condition is nil', () => {
      const e = new Evaluator();
      assert.strictEqual(
        e.eval('(1>2).if(s:="big",s:="small");s').str(),
        '"small"'
      );
    });

    test('should treat non-nil values as truthy', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('1.if("t","f")').str(), '"t"');
    });
  });

  describe('Functions', () => {
    test('should create function with fun', () => {
      const e = new Evaluator();
      assert.strictEqual(
        e.eval('fun(a,b,(a+b).print())').str(),
        'fun(a,b,a.+(b).print())'
      );
    });

    test('should call function with arguments', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('add:=fun(a,b,a+b);add(6/3,2)').str(), '4');
    });

    test('should support recursion', () => {
      const e = new Evaluator();
      assert.strictEqual(
        e.eval('pow:=fun(n,(n<=1).if(1,n*pow(n-1)));pow(3)').str(),
        '6'
      );
    });

    test('should create closure', () => {
      const e = new Evaluator();
      assert.strictEqual(
        e.eval('create:=fun(c:=0;fun(c=c+1));counter:=create();counter();counter()').str(),
        '2'
      );
    });
  });

  describe('Print function', () => {
    test('should print value and return it', () => {
      const logPrinter = new LogPrinter();
      const e = new Evaluator(logPrinter.getPrintFunction());
      assert.strictEqual(e.eval('(1+2).print()').str(), '3');
      assert.strictEqual(logPrinter.getLastLogs(), '3');
    });

    test('should print in function call', () => {
      const logPrinter = new LogPrinter();
      const e = new Evaluator(logPrinter.getPrintFunction());
      assert.strictEqual(
        e.eval('f:=fun((1+2).print());f()').str(),
        '3'
      );
      assert.strictEqual(logPrinter.getLastLogs(), '3');
    });
  });

  describe('Objects', () => {
    test('should access built-in Object', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('Object').str(), '{}');
    });

    test('should clone Object', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('Object.clone()').str(), '{}');
    });

    test('should clone number (returns same value)', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('123.clone()').str(), '123');
    });

    test('should set and get object slot', () => {
      const e = new Evaluator();
      e.eval('o:=Object.clone();o.x:=1');
      assert.strictEqual(e.eval('o').str(), '{x:1}');
      assert.strictEqual(e.eval('o.x').str(), '1');
    });

    test('should support method with this', () => {
      const e = new Evaluator();
      assert.strictEqual(
        e.eval('obj:=Object.clone();obj.v:=12;obj.f:=fun(a,b,this.v+a+b);obj.f(3,2)').str(),
        '17'
      );
    });

    test('should support custom infix operator', () => {
      const e = new Evaluator();
      assert.strictEqual(
        e.eval('obj2:=Object.clone();obj2.setA=fun(arg,this.a=arg);obj2 setA 123;obj2.a').str(),
        '123'
      );
    });

    test('should support prototype chain method lookup', () => {
      const e = new Evaluator();
      const code = `
        parent := Object.clone();
        parent.greet = fun(name, "Hello, " + name);
        child := parent.clone();
        child.name = "Alice";
        child.greet("World")
      `;
      assert.strictEqual(e.eval(code).str(), '"Hello, World"');
    });

    test('should bind this correctly in inherited methods', () => {
      const e = new Evaluator();
      const code = `
        parent := Object.clone();
        parent.getName = fun(x, this.name);
        child := parent.clone();
        child.name = "Alice";
        child.getName("dummy")
      `;
      assert.strictEqual(e.eval(code).str(), '"Alice"');
    });
  });

  describe('Cons cells (Lisp-style lists)', () => {
    test('should create cons cell', () => {
      const e = new Evaluator();
      e.eval('cons:=fun(a,b,o:=Object.clone();o.car=a;o.cdr=b;o)');
      assert.strictEqual(e.eval('cons(1,2)').str(), '{car:1,cdr:2}');
    });

    test('should create and process list', () => {
      const e = new Evaluator();
      e.eval('cons:=fun(a,b,o:=Object.clone();o.car=a;o.cdr=b;o)');
      e.eval('list:=fun(i,n,(i<n).if(cons(i,list(i+1,n)),nil))');
      e.eval('l:=list(0,10)');
      assert.strictEqual(
        e.eval('l').str(),
        '{car:0,cdr:{car:1,cdr:{car:2,cdr:{car:3,cdr:{car:4,cdr:{car:5,cdr:{car:6,cdr:{car:7,cdr:{car:8,cdr:{car:9,cdr:nil}}}}}}}}}}'
      );
    });

    test('should sum list recursively', () => {
      const e = new Evaluator();
      e.eval('cons:=fun(a,b,o:=Object.clone();o.car=a;o.cdr=b;o)');
      e.eval('list:=fun(i,n,(i<n).if(cons(i,list(i+1,n)),nil))');
      e.eval('l:=list(0,10)');
      e.eval('sum:=fun(ls, ls.if(ls.car+sum(ls.cdr),0))');
      assert.strictEqual(e.eval('sum(l)').str(), '45');
    });
  });

  describe('Metaprogramming', () => {
    test('should create Message with method name only', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('message("__","method")').str(), 'method');
    });

    test('should create Message with method call', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('message("_@","method")').str(), 'method()');
    });

    test('should create Message with arguments', () => {
      const e = new Evaluator();
      assert.strictEqual(
        e.eval('message("_@","method", 1,2,3)').str(),
        'method(1, 2, 3)'
      );
    });

    test('should create Message with receiver', () => {
      const e = new Evaluator();
      assert.strictEqual(
        e.eval('message("@_",target,"method")').str(),
        'target.method'
      );
    });

    test('should create full Message with receiver and args', () => {
      const e = new Evaluator();
      assert.strictEqual(
        e.eval('message("@@", target,"method")').str(),
        'target.method()'
      );
      assert.strictEqual(
        e.eval('message("@@", target,"method", 1,2,3)').str(),
        'target.method(1, 2, 3)'
      );
    });

    test('should evaluate Message node', () => {
      const e = new Evaluator();
      assert.strictEqual(
        e.eval('evalNode(message("@@",5,"+",7))').str(),
        '12'
      );
    });

    test('should evaluate string as code', () => {
      const e = new Evaluator();
      assert.strictEqual(e.eval('evalStr("5+7")').str(), '12');
    });
  });

  describe('Macros', () => {
    test('should create and use custom if macro', () => {
      const logPrinter = new LogPrinter();
      const e = new Evaluator(logPrinter.getPrintFunction());
      e.eval('myIf := macro(condition,trueCase,falseCase,evalNode(condition).if(evalNode(trueCase), evalNode(falseCase)))');
      e.eval('numA := 111;numB := 222');
      assert.strictEqual(
        e.eval('myIf(numA<=numB, numA.print(), numB.print())').str(),
        '111'
      );
      assert.strictEqual(logPrinter.getLastLogs(), '111');
    });
  });
});
