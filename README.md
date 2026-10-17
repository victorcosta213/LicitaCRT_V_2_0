# LicitaCRT — CRT-08

Plataforma de gestão contratual e de processos licitatórios.

| Pasta | O que é | Detalhes |
|---|---|---|
| [`frontend/`](frontend/) | Aplicação web (Vite + React), publicada no Vercel | [frontend/README.md](frontend/README.md) |
| [`backend/`](backend/) | Banco no Supabase: migrations, RLS, verificação e testes | [backend/README.md](backend/README.md) |

## Testes

```
cd frontend && npm install && npm test   # regras de negócio e telas
cd backend  && npm install && npm test   # banco: RLS, triggers e migrations
```

## Deploy

- **Banco:** aplique as migrations de `backend/supabase/migrations` no SQL Editor do Supabase e rode `backend/supabase/verificacao.sql`.
- **Web:** no Vercel, *Root Directory* = `frontend`, com as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
