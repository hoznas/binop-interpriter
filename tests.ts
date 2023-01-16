import { tokenize } from './tokenizer'
import { parse } from './parser'
import { Slot } from './slot'
import { Num } from './object'
import { Evaluator } from './evaluator'

function main(){
  tokenizerTest()
  parserTest()
  slotTest()
  evaluatorTest()
}

main()

function tokenizerTest() {
  const tests: [string, string][] = [
      ["123", "123"],
      ["abc", "abc"],
      ['"abc def"', 'abc def'],
      ['abc;def;;zzz', 'abc|;|def|;|zzz'],
      [';;;abc(;c;,;;a;;b;;)  ;;;;;  def("a b c") ; ; xxx; zzz ;;  ;', 'abc|(|c|,|a|;|b|)|;|def|(|a b c|)|;|xxx|;|zzz'],
      //['obj.func((123*456)-789, "abc");123.print', '******'],
      //["123;;;;;456\n\n789;(abc.def;fff(););;", '******'],
  ]
  for (const test of tests) {
      const [code, mustbe] = test
      const result = tokenize(code)
      //console.log(`result=${result}`)
      const result_str = result.map(e => { return e.value }).join("|")
      //console.log(`result_str=${result_str}`)
      if( result_str !== mustbe){
          console.log(`ERROR code=${code} result=${result_str} mustbe=${mustbe}`)
          return
      }
  }

  console.log("[TOKENIZER] All tests are OK.")
}


function parserTest(){
  const tests: [string, string][] = [
      ["123", "123"],
      ['"abc def"', '"abc def"'],
      ["abc", "abc"],
      ['1+2', '(+ 1 2)'],
      ['1+2*3', '(+ 1 (* 2 3))'],
      ['(1+2)*3', '(* (+ 1 2) 3)'],
      ['1.print', '(. 1 print)'],
      ['1.print;2.print;', '(; (. 1 print) (. 2 print))'],
      ['print;print();print(1+2)', '(; (; print print()) print((+ 1 2)))'],
      ['i:=0;while(i<10,x:=i*2;x.println)', '(; (:= i 0) while((< i 10), (; (:= x (* i 2)) (. x println))))'],
      ['print', 'print'],
      ['print()', 'print()'],
      ['print(1)', 'print(1)'],
      ['print(1,2)', 'print(1, 2)'],
      ['(print(1,2))(3)', 'print(1, 2)(3)'],
      ['Object.clone().clone()', '(. (. Object clone()) clone())'],
      //[';;;abc(;c;,;;a;;b;;)  ;;;;;  def("a b c") ; ; xxx; zzz ;;  ;', 'abc|(|c|,|a|;|b|)|;|def|(|a b c|)|;|xxx|;|zzz'],
      //['obj.func((123*456)-789, "abc");123.print', '******'],
      //["123;;;;;456\n\n789;(abc.def;fff(););;", '******'],
  ]
  for (const test of tests) {
      const [code, mustbe] = test
      const tokens = tokenize(code)
  const exp = parse(tokens)
      const result_str = exp.str()
      if( result_str !== mustbe){
        console.log("ERROR")
        console.log("code  ="+code)
        console.log("result="+result_str)
        console.log("mustbe="+mustbe)
        return
      }
  }

  console.log("[PARSER] All tests are OK.")
}


function slotTest(){
  const env = new Slot()
  const sub = env.subSlot()
  env.define("one", new Num(1))
  env.define("two", new Num(2))
  sub.define("three", new Num(3))
  sub.define("four", new Num(4))
  if(env.define("one", new Num(-1)) !== null){
    throw "A"
  }
  if(sub.define("one", new Num(-1)) === null){
    throw "B"
  }
  if(sub.get("one") === null){
    console.log(sub.get("one"))
    throw "C"
  }
  if(sub.update("one", new Num(1)) && env.get("one")!.str()!=="1"){
    throw "D"
  }
  console.log("[SLOT] all tests are ok.")
}


function evaluatorTest(){
	const tests = [
		['123','123'],
		['"abc def"','"abc def"'],
		['1+2*3','7'],
		['(1+2)*3','9'],
		['(1+2)','3'],
		['"abc" + "def"','"abcdef"'],
		['"abc" + 123','"abc123"'],
		['123 + "123"','246'],
		['1 + 1 == 3','nil'],
		['1 + 1;2*4','8'],
		['a := 5; a*4','20'],
		['b := 5; b=b+1; b','6'],
		['print(1,2)','nil'], // print "1,2"
		['fun(print(1+2))','fun(print((+ 1 2)))'],
		['f:=fun(print(1+2));f()','nil'], // print "3"
		['fun(a,b,print(a+b))','fun(a,b,print((+ a b)))'],
		['add:=fun(a,b,a+b);add(6/3,2)','4'],
		['2>1','1'],
		['if(2>1,r:="big",r:="small");r','"big"'],
		['if(1>2,s:="big",s:="small");s','"small"'],
		['pow:=fun(n,if(n<=1,1,n*pow(n-1)));pow(3)','6'],
		['create:=fun(c:=0;fun(c=c+1));counter:=create();counter();counter()','2'],
		['Object','{}'],
		['Object.clone()','{}'],
		['123.print()','nil'], // print 123
		['123.clone()','123'],
		['o:=Object.clone();o.x:=1','1'],
		['o','{x:1}'],
		['cons:=fun(a,b,o:=Object.clone();o.car=a;o.cdr=b;o);1','1'],
		['cons(1,2)','{car:1,cdr:2}'],
		['list:=fun(i,n,if(i<n,cons(i,list(i+1,n)),nil));1','1'],
		['l:=list(0,10)','{car:0,cdr:{car:1,cdr:{car:2,cdr:{car:3,cdr:{car:4,cdr:{car:5,cdr:{car:6,cdr:{car:7,cdr:{car:8,cdr:{car:9,cdr:nil}}}}}}}}}}'],
		['sum:=fun(ls, if(ls, ls.car+sum(ls.cdr),0));1','1'],
		['sum(l)','45'],
	]

	const e = new Evaluator()
	for(let [code,mustbe] of tests){
		const result = e.eval(code).str()
		if(result !== mustbe){
			console.log("[CODE]"+code)
			console.log("[RESULT]"+result)
			console.log("[MUSTBE]"+mustbe)
			console.log('evaluator test error')
      return 
		}
	}
	console.log('[EVALUATOR] all tests are ok.')
}

