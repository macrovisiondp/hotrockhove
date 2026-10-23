CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'sending', 'sent', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."marketing_channel" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."opt_in_status" AS ENUM('subscribed', 'unsubscribed');--> statement-breakpoint
CREATE TYPE "public"."send_status" AS ENUM('pending', 'sending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" "marketing_channel" NOT NULL,
	"name" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"cta_label" text DEFAULT '' NOT NULL,
	"cta_url" text DEFAULT '' NOT NULL,
	"audience" jsonb DEFAULT '{"newsletter":true,"contacts":true}'::jsonb NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text,
	"phone" text,
	"email_status" "opt_in_status" DEFAULT 'subscribed' NOT NULL,
	"sms_status" "opt_in_status" DEFAULT 'subscribed' NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"consent_note" text DEFAULT '' NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"recipient" text NOT NULL,
	"status" "send_status" DEFAULT 'pending' NOT NULL,
	"claimed_at" timestamp with time zone,
	"provider_message_id" text,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_contacts" ADD CONSTRAINT "marketing_contacts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_sends" ADD CONSTRAINT "marketing_sends_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "marketing_campaigns_created_idx" ON "marketing_campaigns" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_contacts_email_idx" ON "marketing_contacts" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_contacts_phone_idx" ON "marketing_contacts" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_sends_campaign_recipient_idx" ON "marketing_sends" USING btree ("campaign_id","recipient");--> statement-breakpoint
CREATE INDEX "marketing_sends_status_idx" ON "marketing_sends" USING btree ("campaign_id","status");