import {
  Bounce,
  Continuation,
  evalFunCallK,
  evalNodeK,
  evalStrK,
  Evaluator,
  Thunk,
  trampoline,
} from './evaluator';
import { Memory } from './memory';
import { BoObject, Fun, Macro, Message, NIL, Str } from './object';

// CPS版の組み込み関数の型
// 継続kを受け取り、Bounceを返す
type FuncTypeK = (
  receiver: BoObject | undefined,
  args: BoObject[],
  env: Memory,
  k: Continuation,
) => Bounce;

export class BuiltinFunction extends BoObject {
  constructor(
    public name: string,
    public fun: FuncTypeK,
  ) {
    super();
  }
  // CPS版: 継続kを受け取る
  callK(
    receiver: BoObject | undefined,
    args: BoObject[],
    env: Memory,
    k: Continuation,
  ): Bounce {
    return this.fun(receiver, args, env, k);
  }
  str(): string {
    return this.name;
  }
}

// fun, macro, message は純粋な値を作るだけなので
// 結果をそのまま継続kに渡す

export const FUN = new BuiltinFunction('fun', (_receiver, args, env, k) => {
  if (args?.length >= 1) return k(new Fun(args, env));
  throw new Error(`ERROR fun(args.len===${args?.length}) arg length error`);
});

export const MACRO = new BuiltinFunction(
  'macro',
  (_receiver, args, _env, k) => {
    if (args.length >= 1) return k(new Macro(args));
    throw new Error(`ERROR macro(args.len===${args.length}) arg length error`);
  },
);

export const MESSAGE = new BuiltinFunction(
  'message',
  (_receiver, args, _env, k) => {
    if (args.length >= 2 && args[0] instanceof Str) {
      const type = args[0].value;
      if (type == '__' && args.length === 2 && args[1] instanceof Str) {
        return k(new Message(undefined, args[1].value, undefined));
      } else if (type === '_@' && args[1] instanceof Str) {
        return k(
          new Message(undefined, args[1].value, args.slice(2, args.length)),
        );
      } else if (type === '@_' && args.length === 3 && args[2] instanceof Str) {
        return k(new Message(args[1], args[2].value, undefined));
      } else if (type === '@@' && args[2] instanceof Str) {
        return k(
          new Message(args[1], args[2].value, args.slice(3, args.length)),
        );
      }
    }
    throw new Error(
      `ERROR MESSAGE(${args
        .map((e) => {
          e.str();
        })
        .join(',')})`,
    );
  },
);

// evalNode: 引数を評価し、その結果をさらに評価する（二重評価）
export const EVAL_NODE = new BuiltinFunction(
  'evalNode',
  (_receiver, args, env, k) => {
    if (args.length === 1) {
      // 1回目の評価: ASTノードを得る
      return evalNodeK(
        args[0],
        env,
        (innerNode) =>
          // 2回目の評価: 得られたASTを実行する
          new Thunk(() => evalNodeK(innerNode, env, k)),
      );
    }
    throw new Error(
      `ERROR evalNode(args.len===${args.length}) arg length error`,
    );
  },
);

// evalStr: 文字列をコードとして評価する
export const EVAL_STR = new BuiltinFunction(
  'evalStr',
  (_receiver, args, env, k) => {
    if (args.length === 1 && args[0] instanceof Str) {
      return evalStrK(args[0].value, env, k);
    }
    throw new Error(
      `ERROR evalStr(args.len===${args.length}) arg length error`,
    );
  },
);

///////////////////////////////////////////
// デフォルトメソッド（CPS版）
// receiver.if(...), receiver.print(), receiver.clone(), receiver.doWhile(...)

// if: 条件分岐
// receiverを評価 → 真ならargs[0]を、偽ならargs[1]を末尾位置で評価
const evalIfK = (mes: Message, env: Memory, k: Continuation): Bounce => {
  if (!mes.receiver) throw new Error('ERROR evalIf(no receiver)');
  if (!(mes.args?.length === 1 || mes.args?.length === 2))
    throw new Error('ERROR evalIf(arg length error)');
  return evalNodeK(mes.receiver, env, (receiver) => {
    const block = receiver !== NIL ? mes.args![0] : mes.args![1] || NIL;
    return new Thunk(() => evalNodeK(block, env, k)); // 末尾位置
  });
};

// print: 値を表示して返す
const evalPrintK = (mes: Message, env: Memory, k: Continuation): Bounce => {
  if (!mes.receiver) throw new Error('ERROR evalPrint(no receiver)');
  if (mes.args?.length !== 0)
    throw new Error('ERROR evalPrint(arg length error)');
  return evalNodeK(mes.receiver, env, (result) => {
    Evaluator.print(result.str());
    return k(result);
  });
};

// clone: オブジェクトを複製して返す
const evalCloneK = (mes: Message, env: Memory, k: Continuation): Bounce => {
  if (!mes.receiver) throw new Error('ERROR evalClone(no receiver)');
  if (mes.args?.length !== 0)
    throw new Error('ERROR evalClone(arg length error)');
  return evalNodeK(mes.receiver, env, (result) => k(result.clone()));
};

// デフォルトメソッドのマップ（CPS版）
export type DefaultMethodK = (
  mes: Message,
  env: Memory,
  k: Continuation,
) => Bounce;
export const defaultMethodMapK: { [key: string]: DefaultMethodK } = {
  if: evalIfK,
  print: evalPrintK,
  clone: evalCloneK,
};
