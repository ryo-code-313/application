# ミュウツー厳選チェッカー

ポケモンスリープのミュウツー(スキル型)向けの厳選チェッカーです。選んだサブスキル・性格から、1日あたりの期待スキル発動回数を計算し、無補正個体との比較や全パターン中の順位を表示します。

## 公開ページ

https://ryo-code-313.github.io/application/

## 構成

- `index.html` — マークアップ
- `css/style.css` — スタイル
- `js/constants.js` — サブスキル・性格などのゲームデータ
- `js/calc.js` — 期待値計算エンジン(DOM非依存)
- `js/format.js` — 表示用フォーマット関数
- `js/state.js` — アプリ状態管理・localStorage永続化
- `js/ui.js` — DOM描画・イベント処理
- `js/main.js` — エントリーポイント

## ローカルで動かす

ES modules を使っているため、`file://` で直接開くのではなく簡易サーバーが必要です。

```bash
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000` を開いてください。
