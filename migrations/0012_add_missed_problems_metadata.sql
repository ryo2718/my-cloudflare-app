-- フロップ(ポストフロップ)トレーニングの間違えた問題を保存できるようにする。
-- 案C: 既存 missed_problems テーブルに nullable な metadata(JSON)カラムを1つ追加するだけ。
-- フロップ固有情報(board / pot / variant / kind / hand)を metadata に JSON で持つ。
-- 共通列(training_type / hero_position / score_obtained / created_at 等)は流用する。
-- プリフロップ既存行は metadata=NULL のまま影響を受けない(テーブル再構築なし)。
ALTER TABLE missed_problems ADD COLUMN metadata TEXT;
