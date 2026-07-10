CREATE TYPE "public"."actor_type" AS ENUM('USER', 'API_KEY', 'MCP', 'SYSTEM', 'PUBLIC_LINK');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'EXPIRED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."channel_status" AS ENUM('ACTIVE', 'PENDING_ACCOUNT_SELECTION', 'REFRESH_REQUIRED', 'DISABLED');--> statement-breakpoint
CREATE TYPE "public"."group_state" AS ENUM('DRAFT', 'SCHEDULED', 'PARTIAL', 'DONE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('OWNER', 'ADMIN', 'MEMBER');--> statement-breakpoint
CREATE TYPE "public"."post_origin" AS ENUM('WEB', 'API', 'MCP', 'AUTOMATION');--> statement-breakpoint
CREATE TYPE "public"."publication_state" AS ENUM('DRAFT', 'SCHEDULED', 'PUBLISHING', 'RETRYING', 'TOKEN_REFRESH', 'PUBLISHED', 'FAILED', 'CANCELLED', 'NEEDS_REVIEW');--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"username" text,
	"avatar_url" text,
	"token_enc" "bytea" NOT NULL,
	"refresh_token_enc" "bytea",
	"token_key_version" integer DEFAULT 1 NOT NULL,
	"token_expires_at" timestamp with time zone,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"status" "channel_status" DEFAULT 'ACTIVE' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"root_external_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"status" "approval_status" DEFAULT 'PENDING' NOT NULL,
	"feedback" text,
	"approver_name" text,
	"approver_ip" text,
	"expires_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_metrics" (
	"channel_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"day" date NOT NULL,
	"value" numeric NOT NULL,
	CONSTRAINT "channel_metrics_channel_id_metric_day_pk" PRIMARY KEY("channel_id","metric","day")
);
--> statement-breakpoint
CREATE TABLE "channel_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"channel_ids" uuid[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"path" text NOT NULL,
	"mime" text NOT NULL,
	"byte_size" bigint DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"duration_sec" integer,
	"thumbnail_path" text,
	"alt" text,
	"blurhash" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_group_tags" (
	"group_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "post_group_tags_group_id_tag_id_pk" PRIMARY KEY("group_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "post_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"author_id" uuid,
	"base_content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"publish_at" timestamp with time zone,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"state" "group_state" DEFAULT 'DRAFT' NOT NULL,
	"recurrence" jsonb,
	"origin" "post_origin" DEFAULT 'WEB' NOT NULL,
	"idempotency_key" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publication_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"publication_id" uuid NOT NULL,
	"from_state" "publication_state",
	"to_state" "publication_state" NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publication_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"publication_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"media" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"delay_sec" integer DEFAULT 0 NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"state" "publication_state" DEFAULT 'DRAFT' NOT NULL,
	"publish_at" timestamp with time zone,
	"external_id" text,
	"release_url" text,
	"error_class" text,
	"error_message" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_published_index" integer DEFAULT -1 NOT NULL,
	"attempt_id" uuid,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signatures" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"auto_add" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6B6B70' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'MEMBER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"rotated_from" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"locale" text DEFAULT 'pt-BR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_credits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text DEFAULT 'general' NOT NULL,
	"granted" integer NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_org_id_key_pk" PRIMARY KEY("org_id","key")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_apps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_hash" text NOT NULL,
	"redirect_uris" text[] DEFAULT '{}' NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_grants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"oauth_app_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text,
	"code_challenge" text,
	"code_expires_at" timestamp with time zone,
	"access_token_hash" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_hash" text,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret_enc" "bytea" NOT NULL,
	"secret_key_version" integer DEFAULT 1 NOT NULL,
	"events" text[] DEFAULT '{}' NOT NULL,
	"channel_ids" uuid[] DEFAULT '{}' NOT NULL,
	"disabled_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_links" ADD CONSTRAINT "approval_links_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_links" ADD CONSTRAINT "approval_links_group_id_post_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."post_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_metrics" ADD CONSTRAINT "channel_metrics_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_sets" ADD CONSTRAINT "channel_sets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_group_tags" ADD CONSTRAINT "post_group_tags_group_id_post_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."post_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_group_tags" ADD CONSTRAINT "post_group_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_groups" ADD CONSTRAINT "post_groups_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_groups" ADD CONSTRAINT "post_groups_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_events" ADD CONSTRAINT "publication_events_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_items" ADD CONSTRAINT "publication_items_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_group_id_post_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."post_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_credits" ADD CONSTRAINT "ai_credits_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_apps" ADD CONSTRAINT "oauth_apps_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_oauth_app_id_oauth_apps_id_fk" FOREIGN KEY ("oauth_app_id") REFERENCES "public"."oauth_apps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channels_org_provider_ext_ux" ON "channels" USING btree ("org_id","provider","external_id");--> statement-breakpoint
CREATE INDEX "channels_org_ix" ON "channels" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "channels_refresh_needed_ix" ON "channels" USING btree ("org_id") WHERE "channels"."status" = 'REFRESH_REQUIRED';--> statement-breakpoint
CREATE UNIQUE INDEX "approval_links_token_ux" ON "approval_links" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_links_pending_group_ux" ON "approval_links" USING btree ("group_id") WHERE "approval_links"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "channel_sets_org_ix" ON "channel_sets" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "media_org_ix" ON "media" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "post_groups_idem_ux" ON "post_groups" USING btree ("org_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "post_groups_org_state_ix" ON "post_groups" USING btree ("org_id","state");--> statement-breakpoint
CREATE INDEX "post_groups_org_publish_ix" ON "post_groups" USING btree ("org_id","publish_at");--> statement-breakpoint
CREATE INDEX "publication_events_pub_ix" ON "publication_events" USING btree ("publication_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "publication_items_pos_ux" ON "publication_items" USING btree ("publication_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "publications_group_channel_ux" ON "publications" USING btree ("group_id","channel_id");--> statement-breakpoint
CREATE INDEX "publications_org_state_date_ix" ON "publications" USING btree ("org_id","state","publish_at");--> statement-breakpoint
CREATE INDEX "publications_due_ix" ON "publications" USING btree ("publish_at") WHERE "publications"."state" = 'SCHEDULED';--> statement-breakpoint
CREATE INDEX "publications_stuck_ix" ON "publications" USING btree ("updated_at") WHERE "publications"."state" IN ('PUBLISHING', 'TOKEN_REFRESH');--> statement-breakpoint
CREATE INDEX "signatures_org_ix" ON "signatures" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "tags_org_ix" ON "tags" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_hash_ux" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_prefix_ix" ON "api_keys" USING btree ("prefix") WHERE "api_keys"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "api_keys_org_ix" ON "api_keys" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_org_user_ux" ON "memberships" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "memberships_user_ix" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_ux" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_refresh_hash_ux" ON "sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_ix" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_ux" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "ai_credits_org_ix" ON "ai_credits" USING btree ("org_id","period_end");--> statement-breakpoint
CREATE INDEX "audit_log_org_ix" ON "audit_log" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_org_ix" ON "notifications" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_apps_client_ux" ON "oauth_apps" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_grants_access_ix" ON "oauth_grants" USING btree ("access_token_hash");--> statement-breakpoint
CREATE INDEX "oauth_grants_code_ix" ON "oauth_grants" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "oauth_grants_app_user_ix" ON "oauth_grants" USING btree ("oauth_app_id","user_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_retry_ix" ON "webhook_deliveries" USING btree ("next_retry_at") WHERE "webhook_deliveries"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "webhooks_org_ix" ON "webhooks" USING btree ("org_id");