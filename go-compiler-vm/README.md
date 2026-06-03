# go-compiler-vm

BinOp のバイトコードコンパイラ + スタック VM 実装です。

## ビルド

```bash
./build.sh
# → bin/binop-compiler と bin/binop-vm が生成される
```

## 実行

### スクリプトで実行（推奨）

```bash
./run.sh ../sample.bo
```

内部では `binop-compiler` の stdout を `binop-vm` の stdin にパイプしています。

### 手動で実行

```bash
# パイプで実行
./bin/binop-compiler sample.bo | ./bin/binop-vm

# IL をファイルに出力してから実行
./bin/binop-compiler sample.bo > out.il
./bin/binop-vm out.il

# コンパイラの出力（IL テキスト）だけ確認
./bin/binop-compiler sample.bo
```

## テスト

```bash
cd go-compiler && go test ./...
cd go-vm       && go test ./...
```

## 構成

```
go-compiler/   BinOp ソース → IL テキスト（標準出力）
go-vm/         IL テキスト（標準入力 or ファイル） → 実行
bin/           ビルド済みバイナリ
```

詳細は [OVERVIEW.md](OVERVIEW.md) を参照。
