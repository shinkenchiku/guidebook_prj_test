# guidebook_prj_test

ガイドブック企画のモックアップ制作（速水）

## 注意

- モックアップ開発としてこのリポジトリを使用中
- Gemini CLIを用いて開発中。
  - `Requirement.md`に要件を集約し、指示の基本としている。

## フォルダ構成

```text
guidebook_prj_test/
├── main.py                # メインの実行ファイル
├── Requirement.md         # プロジェクトの要件定義・進捗管理
├── pyproject.toml         # Python環境設定 (uv/pip)
├── data/                  # 建築データ（JSON）の保存先
├── data_editing/          # データ収集・加工用スクリプト (Python)
├── keys/                  # APIキー等の機密情報 (Git管理外を推奨)
├── js/                    # フロントエンド (Next.js / TypeScript)
│   ├── src/               # ソースコード (App Router)
│   ├── public/            # 静的アセット（画像、データ）
│   └── next.config.ts     # Next.js設定
└── README.md              # 本ファイル
```
