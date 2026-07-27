ALTER TABLE "media" ADD COLUMN "source" text DEFAULT 'upload' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "generation_prompt" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "generation_model" text;