# TROMEN Dashboard — Panel Administrativo
BYF Soluciones · Next.js 14 + Mapbox + Tailwind

## Setup local

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Deploy en Vercel (gratis)

1. Subí la carpeta `dashboard` a un repo de GitHub
2. Entrá a vercel.com → New Project → importá el repo
3. Agregá estas variables de entorno en Vercel:

```
NEXT_PUBLIC_API_URL = https://tromen-backend-production.up.railway.app
NEXT_PUBLIC_MAPBOX_TOKEN = pk.eyJ1IjoiZ2FzdG9uciIsImEiOiJjbXA4emdrN2cwMG50MnFvaWUwODhyeXp5In0.UkeY4mgv-NKeLz8W-tKTSw
```

4. Deploy — en 2 minutos tenés la URL pública

## Funcionalidades

- Login con roles (solo admin y supervisor)
- Mapa en tiempo real con posición de repartidores
- Stats del día: rutas, entregas, cobros
- Progreso por repartidor con barra visual
- Desglose de cobros: efectivo / transferencia / fiado
- Saldos de cuenta corriente por cliente
- Alertas automáticas: rutas paradas, saldos vencidos
- Auto-refresh cada 30 segundos

## Stack

- Next.js 14 App Router
- React Map GL + Mapbox
- Tailwind CSS
- Axios
- date-fns
- Recharts
