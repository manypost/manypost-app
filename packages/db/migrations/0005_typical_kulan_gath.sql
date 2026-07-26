CREATE TYPE "public"."attempt_state" AS ENUM('CLAIMED', 'CONFIRMED', 'FAILED_SAFE', 'INDETERMINATE');--> statement-breakpoint
CREATE TABLE "publication_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"publication_id" uuid NOT NULL,
	"job_version" integer NOT NULL,
	"position" integer NOT NULL,
	"state" "attempt_state" DEFAULT 'CLAIMED' NOT NULL,
	"owner_token" text NOT NULL,
	"lease_expires_at" timestamp with time zone NOT NULL,
	"idempotency_key" text NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "publication_attempts" ADD CONSTRAINT "publication_attempts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_attempts" ADD CONSTRAINT "publication_attempts_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "publication_attempts_item_ux" ON "publication_attempts" USING btree ("publication_id","job_version","position");--> statement-breakpoint
CREATE INDEX "publication_attempts_owner_ix" ON "publication_attempts" USING btree ("owner_token");--> statement-breakpoint
CREATE INDEX "publication_attempts_org_ix" ON "publication_attempts" USING btree ("org_id","publication_id");