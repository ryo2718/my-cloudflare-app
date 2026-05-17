import { onRequestGet as __api_admin_accounts_ts_onRequestGet } from "/Users/shirairyouitaru/pokerprojects/pokergtoapp/functions/api/admin/accounts.ts"
import { onRequestPost as __api_admin_group_key_ts_onRequestPost } from "/Users/shirairyouitaru/pokerprojects/pokergtoapp/functions/api/admin/group_key.ts"
import { onRequestGet as __api_admin_group_keys_ts_onRequestGet } from "/Users/shirairyouitaru/pokerprojects/pokergtoapp/functions/api/admin/group_keys.ts"
import { onRequestPost as __api_auth_login_ts_onRequestPost } from "/Users/shirairyouitaru/pokerprojects/pokergtoapp/functions/api/auth/login.ts"
import { onRequestPost as __api_auth_logout_ts_onRequestPost } from "/Users/shirairyouitaru/pokerprojects/pokergtoapp/functions/api/auth/logout.ts"
import { onRequestGet as __api_auth_me_ts_onRequestGet } from "/Users/shirairyouitaru/pokerprojects/pokergtoapp/functions/api/auth/me.ts"
import { onRequestPost as __api_auth_signup_ts_onRequestPost } from "/Users/shirairyouitaru/pokerprojects/pokergtoapp/functions/api/auth/signup.ts"
import { onRequest as ___middleware_ts_onRequest } from "/Users/shirairyouitaru/pokerprojects/pokergtoapp/functions/_middleware.ts"

export const routes = [
    {
      routePath: "/api/admin/accounts",
      mountPath: "/api/admin",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_accounts_ts_onRequestGet],
    },
  {
      routePath: "/api/admin/group_key",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_group_key_ts_onRequestPost],
    },
  {
      routePath: "/api/admin/group_keys",
      mountPath: "/api/admin",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_group_keys_ts_onRequestGet],
    },
  {
      routePath: "/api/auth/login",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_login_ts_onRequestPost],
    },
  {
      routePath: "/api/auth/logout",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_logout_ts_onRequestPost],
    },
  {
      routePath: "/api/auth/me",
      mountPath: "/api/auth",
      method: "GET",
      middlewares: [],
      modules: [__api_auth_me_ts_onRequestGet],
    },
  {
      routePath: "/api/auth/signup",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_signup_ts_onRequestPost],
    },
  {
      routePath: "/",
      mountPath: "/",
      method: "",
      middlewares: [___middleware_ts_onRequest],
      modules: [],
    },
  ]