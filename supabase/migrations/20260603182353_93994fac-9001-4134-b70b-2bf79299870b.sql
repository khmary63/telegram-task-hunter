
-- Niches
CREATE TABLE public.niches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.niches TO authenticated;
GRANT ALL ON public.niches TO service_role;
ALTER TABLE public.niches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read niches" ON public.niches FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write niches" ON public.niches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Keywords
CREATE TABLE public.keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phrase TEXT NOT NULL,
  niche_id UUID REFERENCES public.niches(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'exact' CHECK (type IN ('exact','semantic')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_keywords_active ON public.keywords(is_active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.keywords TO authenticated;
GRANT ALL ON public.keywords TO service_role;
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all keywords" ON public.keywords FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Chats
CREATE TABLE public.chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tg_chat_id BIGINT,
  username TEXT NOT NULL,
  title TEXT,
  niche_id UUID REFERENCES public.niches(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(username)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chats TO authenticated;
GRANT ALL ON public.chats TO service_role;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all chats" ON public.chats FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Chat suggestions (autodiscovered)
CREATE TABLE public.chat_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  source_chat TEXT,
  mentions_count INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','added','ignored')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_suggestions TO authenticated;
GRANT ALL ON public.chat_suggestions TO service_role;
ALTER TABLE public.chat_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all suggestions" ON public.chat_suggestions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Leads (matched messages)
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES public.chats(id) ON DELETE SET NULL,
  chat_username TEXT,
  chat_title TEXT,
  tg_message_id BIGINT NOT NULL,
  tg_chat_id BIGINT NOT NULL,
  message_link TEXT,
  author_username TEXT,
  author_user_id BIGINT,
  author_display_name TEXT,
  message_text TEXT NOT NULL,
  matched_keyword_id UUID REFERENCES public.keywords(id) ON DELETE SET NULL,
  matched_phrase TEXT,
  matched_niche_id UUID REFERENCES public.niches(id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ NOT NULL,
  found_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  UNIQUE(tg_chat_id, tg_message_id, matched_keyword_id)
);
CREATE INDEX idx_leads_posted_at ON public.leads(posted_at DESC);
CREATE INDEX idx_leads_niche ON public.leads(matched_niche_id);
CREATE INDEX idx_leads_chat ON public.leads(chat_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all leads" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Worker state (single row)
CREATE TABLE public.worker_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_heartbeat TIMESTAMPTZ,
  last_error TEXT,
  messages_processed BIGINT NOT NULL DEFAULT 0,
  leads_found BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_state TO authenticated;
GRANT ALL ON public.worker_state TO service_role;
ALTER TABLE public.worker_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all worker_state" ON public.worker_state FOR ALL TO authenticated USING (true) WITH CHECK (true);
INSERT INTO public.worker_state(id) VALUES (1);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.worker_state;

-- Seed niches
INSERT INTO public.niches(name) VALUES
  ('Внедрение ИИ сотрудников'),
  ('Разработка ботов'),
  ('Разработка веб и мобильных приложений'),
  ('Вайб-кодинг'),
  ('Разработка сайтов и лендингов'),
  ('Разработка LLM'),
  ('Внедрение в бизнес'),
  ('Голосовые помощники и ассистенты');

-- Seed exact keywords (без привязки к нише)
INSERT INTO public.keywords(phrase, type) VALUES
  ('хочу ИИ попробовать', 'exact'),
  ('нужна онлайн запись', 'exact'),
  ('нужна онлайн бронь', 'exact'),
  ('ищу разработчика', 'exact'),
  ('кто делал систему учёта', 'exact'),
  ('нужна crm', 'exact'),
  ('посоветуйте сайт под заказ', 'exact'),
  ('сделать приложение под заказ', 'exact');

-- Seed semantic keywords per niche
DO $$
DECLARE
  n_ai UUID := (SELECT id FROM public.niches WHERE name='Внедрение ИИ сотрудников');
  n_bot UUID := (SELECT id FROM public.niches WHERE name='Разработка ботов');
  n_app UUID := (SELECT id FROM public.niches WHERE name='Разработка веб и мобильных приложений');
  n_vibe UUID := (SELECT id FROM public.niches WHERE name='Вайб-кодинг');
  n_site UUID := (SELECT id FROM public.niches WHERE name='Разработка сайтов и лендингов');
  n_llm UUID := (SELECT id FROM public.niches WHERE name='Разработка LLM');
  n_biz UUID := (SELECT id FROM public.niches WHERE name='Внедрение в бизнес');
  n_voice UUID := (SELECT id FROM public.niches WHERE name='Голосовые помощники и ассистенты');
BEGIN
  INSERT INTO public.keywords(phrase, niche_id, type) VALUES
    ('ии сотрудник', n_ai, 'semantic'),
    ('ai сотрудник', n_ai, 'semantic'),
    ('автоматизировать сотрудника', n_ai, 'semantic'),
    ('заменить менеджера ии', n_ai, 'semantic'),

    ('нужен бот', n_bot, 'semantic'),
    ('telegram бот', n_bot, 'semantic'),
    ('чат бот', n_bot, 'semantic'),
    ('заказать бота', n_bot, 'semantic'),

    ('мобильное приложение', n_app, 'semantic'),
    ('веб приложение', n_app, 'semantic'),
    ('разработка приложения', n_app, 'semantic'),
    ('сделать приложение', n_app, 'semantic'),

    ('vibe coding', n_vibe, 'semantic'),
    ('вайб кодинг', n_vibe, 'semantic'),
    ('lovable', n_vibe, 'semantic'),
    ('cursor', n_vibe, 'semantic'),

    ('лендинг', n_site, 'semantic'),
    ('landing', n_site, 'semantic'),
    ('сайт под ключ', n_site, 'semantic'),
    ('разработка сайта', n_site, 'semantic'),

    ('обучить llm', n_llm, 'semantic'),
    ('файнтюн', n_llm, 'semantic'),
    ('fine-tune', n_llm, 'semantic'),
    ('своя модель', n_llm, 'semantic'),

    ('автоматизация бизнеса', n_biz, 'semantic'),
    ('внедрить ии в бизнес', n_biz, 'semantic'),
    ('автоматизировать процессы', n_biz, 'semantic'),

    ('голосовой помощник', n_voice, 'semantic'),
    ('голосовой ассистент', n_voice, 'semantic'),
    ('voice agent', n_voice, 'semantic'),
    ('голосовой агент', n_voice, 'semantic');
END $$;
