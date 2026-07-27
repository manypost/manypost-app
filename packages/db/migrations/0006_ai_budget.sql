CREATE TABLE "ai_grants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"credit_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"estimated_credits" integer NOT NULL,
	"state" text DEFAULT 'RESERVED' NOT NULL,
	"credits" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_credits" ADD COLUMN "reserved" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_grants" ADD CONSTRAINT "ai_grants_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_grants" ADD CONSTRAINT "ai_grants_credit_id_ai_credits_id_fk" FOREIGN KEY ("credit_id") REFERENCES "public"."ai_credits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_grants_org_ix" ON "ai_grants" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_grants_reclaim_ix" ON "ai_grants" USING btree ("org_id","state","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_credits_period_ux" ON "ai_credits" USING btree ("org_id","kind","period_start");