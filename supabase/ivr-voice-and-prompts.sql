-- TTS voice + editable prompts for the IVR. NULL on prompt columns means
-- "use the built-in default" so existing installs keep current copy.

alter table dd_ivr_settings add column if not exists tts_voice text not null default 'Azure.en-US-JennyNeural';
alter table dd_ivr_settings add column if not exists greeting text;
alter table dd_ivr_settings add column if not exists option_label_0 text;
alter table dd_ivr_settings add column if not exists option_label_2 text;
alter table dd_ivr_settings add column if not exists option_label_3 text;
alter table dd_ivr_settings add column if not exists option_label_4 text;
alter table dd_ivr_settings add column if not exists voicemail_prompt text;
