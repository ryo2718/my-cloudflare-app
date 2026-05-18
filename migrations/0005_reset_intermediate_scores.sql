-- 中級トレーニングの仕様変更 (BB 応答 4 アクション + 頻度ベース採点) に伴い
-- 既存ユーザーの中級スコアをリセット。
-- 旧採点 (3pt × 20問 = 60pt 系) と新採点 (1問 -1〜+2pt = 40pt 系) は互換性がないため。
DELETE FROM training_results WHERE training_type = 'preflop_intermediate';
