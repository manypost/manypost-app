ALTER TABLE "oauth_apps" ALTER COLUMN "org_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_apps" ALTER COLUMN "client_secret_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_apps" ADD COLUMN "token_endpoint_auth_method" text;--> statement-breakpoint
ALTER TABLE "oauth_apps" ADD COLUMN "client_uri" text;--> statement-breakpoint
ALTER TABLE "oauth_grants" ADD COLUMN "prev_refresh_token_hash" text;--> statement-breakpoint
ALTER TABLE "oauth_grants" ADD COLUMN "resource" text;--> statement-breakpoint
CREATE INDEX "oauth_grants_refresh_ix" ON "oauth_grants" USING btree ("refresh_token_hash");