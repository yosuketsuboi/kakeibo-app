-- ============================================================
-- 1. テーブル作成（関数やポリシーより先に全テーブルを定義）
-- ============================================================

-- Households
CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Household members
CREATE TABLE public.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(household_id, user_id)
);

-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#94a3b8',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Receipts
CREATE TABLE public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  image_path text NOT NULL,
  store_name text,
  total_amount numeric(12,0),
  purchased_at date,
  ocr_status text NOT NULL DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'done', 'error')),
  ocr_raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Receipt items
CREATE TABLE public.receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(12,0) NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Manual expenses
CREATE TABLE public.manual_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  amount numeric(12,0) NOT NULL,
  description text NOT NULL,
  expense_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Invitations
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  email text NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. ヘルパー関数（テーブル作成後に定義）
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_household_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT household_id FROM public.household_members
  WHERE user_id = auth.uid();
$$;

-- ============================================================
-- 3. RLS 有効化 + ポリシー
-- ============================================================

-- Households
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own households"
  ON public.households FOR SELECT
  USING (id IN (SELECT public.get_my_household_ids()));

CREATE POLICY "Authenticated users can create households"
  ON public.households FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Household members
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of own households"
  ON public.household_members FOR SELECT
  USING (household_id IN (SELECT public.get_my_household_ids()));

CREATE POLICY "Owners can insert members"
  ON public.household_members FOR INSERT
  WITH CHECK (
    household_id IN (SELECT public.get_my_household_ids())
    OR
    -- Allow self-insertion when creating a new household
    user_id = auth.uid()
  );

CREATE POLICY "Owners can delete members"
  ON public.household_members FOR DELETE
  USING (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view categories of own households"
  ON public.categories FOR SELECT
  USING (household_id IN (SELECT public.get_my_household_ids()));

CREATE POLICY "Users can manage categories of own households"
  ON public.categories FOR INSERT
  WITH CHECK (household_id IN (SELECT public.get_my_household_ids()));

CREATE POLICY "Users can update categories of own households"
  ON public.categories FOR UPDATE
  USING (household_id IN (SELECT public.get_my_household_ids()));

CREATE POLICY "Users can delete categories of own households"
  ON public.categories FOR DELETE
  USING (household_id IN (SELECT public.get_my_household_ids()));

-- Receipts
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view receipts of own households"
  ON public.receipts FOR SELECT
  USING (household_id IN (SELECT public.get_my_household_ids()));

CREATE POLICY "Users can insert receipts to own households"
  ON public.receipts FOR INSERT
  WITH CHECK (household_id IN (SELECT public.get_my_household_ids()));

CREATE POLICY "Users can update receipts of own households"
  ON public.receipts FOR UPDATE
  USING (household_id IN (SELECT public.get_my_household_ids()));

CREATE POLICY "Users can delete receipts of own households"
  ON public.receipts FOR DELETE
  USING (household_id IN (SELECT public.get_my_household_ids()));

-- Receipt items
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view receipt items via receipt"
  ON public.receipt_items FOR SELECT
  USING (
    receipt_id IN (
      SELECT id FROM public.receipts
      WHERE household_id IN (SELECT public.get_my_household_ids())
    )
  );

CREATE POLICY "Users can insert receipt items via receipt"
  ON public.receipt_items FOR INSERT
  WITH CHECK (
    receipt_id IN (
      SELECT id FROM public.receipts
      WHERE household_id IN (SELECT public.get_my_household_ids())
    )
  );

CREATE POLICY "Users can update receipt items via receipt"
  ON public.receipt_items FOR UPDATE
  USING (
    receipt_id IN (
      SELECT id FROM public.receipts
      WHERE household_id IN (SELECT public.get_my_household_ids())
    )
  );

CREATE POLICY "Users can delete receipt items via receipt"
  ON public.receipt_items FOR DELETE
  USING (
    receipt_id IN (
      SELECT id FROM public.receipts
      WHERE household_id IN (SELECT public.get_my_household_ids())
    )
  );

-- Manual expenses
ALTER TABLE public.manual_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view expenses of own households"
  ON public.manual_expenses FOR SELECT
  USING (household_id IN (SELECT public.get_my_household_ids()));

CREATE POLICY "Users can insert expenses to own households"
  ON public.manual_expenses FOR INSERT
  WITH CHECK (household_id IN (SELECT public.get_my_household_ids()));

CREATE POLICY "Users can update expenses of own households"
  ON public.manual_expenses FOR UPDATE
  USING (household_id IN (SELECT public.get_my_household_ids()));

CREATE POLICY "Users can delete expenses of own households"
  ON public.manual_expenses FOR DELETE
  USING (household_id IN (SELECT public.get_my_household_ids()));

-- Invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invitations of own households"
  ON public.invitations FOR SELECT
  USING (household_id IN (SELECT public.get_my_household_ids()));

CREATE POLICY "Owners can create invitations"
  ON public.invitations FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Allow reading invitation by token (for accepting)
CREATE POLICY "Anyone can view invitation by token"
  ON public.invitations FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update invitation by token"
  ON public.invitations FOR UPDATE
  USING (accepted_at IS NULL AND expires_at > now());

-- ============================================================
-- 4. Storage bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "Users can upload receipt images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can view receipt images of own households"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND auth.uid() IS NOT NULL
  );
