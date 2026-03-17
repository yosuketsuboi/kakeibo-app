# kakeibo-app プロジェクト情報

## 概要
家計簿アプリ。レシートをOCRで読み取り、支出を管理する。

## 技術スタック
- **フレームワーク**: Next.js 15（App Router）
- **データベース**: Supabase（PostgreSQL + RLS）
- **スタイル**: Tailwind CSS
- **デプロイ**: Vercel（GitHub連携による自動デプロイ）

## 主要ディレクトリ
- `src/app/(app)/` - 認証済みページ群
- `src/components/providers/` - HouseholdProvider など
- `src/lib/hooks/` - useHousehold など共通フック
- `src/lib/types/database.ts` - Supabase テーブル型定義
- `public/sw.js` - Service Worker（キャッシュ戦略 v3）

## 主要ページ
- `/dashboard` - 月別支出グラフ・カテゴリ別内訳
- `/expenses` - 支出一覧（カテゴリフィルタ付き）
- `/expenses/new` - 手動入力
- `/expenses/[id]` - 支出編集
- `/receipts/[id]` - レシート詳細・明細編集
- `/payment-methods` - 支払方法管理（CRUD）
- `/settings` - 設定

## 実装済み機能
- レシートOCR読み取り
- カテゴリ管理
- 支払方法管理（payment_methods テーブル）
- 支出一覧のカテゴリフィルタ（レシート・手動入力両対応）
- ダッシュボードのカテゴリ別円グラフ・月別推移グラフ

## 開発コマンド
```bash
npm run dev    # 開発サーバー起動（http://localhost:3000）
npm run build  # ビルド確認
```

## デプロイ
```bash
git push origin main  # GitHub push → Vercel 自動デプロイ
```
SSH設定: `~/.ssh/config` の `github.com.yosuketsuboi` エイリアスを使用。
push前に `ssh-add ~/.ssh/id_ed25519_rs` が必要な場合あり。

## 注意事項
- Supabase RLS ポリシーはサブクエリ方式（`get_my_household_ids()` 関数不使用）
- Service Worker は `/_next/` バンドルをキャッシュしない設定
- `HouseholdProvider` の `refreshPaymentMethods()` を支払方法CRUD後に呼ぶこと
