-- 0013_add_tester_vip:
--  - accounts.tester     : 1 なら group_key 不要 (無期限免除)。既定 0。
--  - accounts.vip_until  : この時刻 (ms epoch) まで group_key 免除。NULL = VIP なし。
--  admin が管理画面 (account-grant API) から手動で付与/解除する。
--  列追加は後方互換 (既存行は DEFAULT 0 / NULL で影響なし)。
--
--  ryoji への初期付与は 0008 (is_ranking_excluded) と同じパターン。

ALTER TABLE accounts ADD COLUMN tester INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN vip_until INTEGER;

UPDATE accounts SET tester = 1 WHERE poker_name = 'ryoji';
