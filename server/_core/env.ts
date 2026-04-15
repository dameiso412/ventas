export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  adminEmail: process.env.ADMIN_EMAIL ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  isProduction: process.env.NODE_ENV === "production",
  fbAccessToken: process.env.FB_ACCESS_TOKEN ?? "",
  metaAdAccountId: process.env.META_AD_ACCOUNT_ID ?? "act_1347234229107497",
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  manychatApiToken: process.env.MANYCHAT_API_TOKEN ?? "",
  manychatCrmFieldId: process.env.MANYCHAT_CRM_FIELD_ID ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  appUrl: process.env.APP_URL || process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : "http://localhost:3000",
};
