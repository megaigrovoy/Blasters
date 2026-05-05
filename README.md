# Blasters (Web MediaPipe)

Кооп-игра для двух человек перед одной камерой: трекинг как в **Web-mediapipe**, но вместо ниндзи — **автострельба** из поднятых ладоней по направлению «запястье → кончик указательного».

## Запуск

```bash
npm install
npm run dev
```

Открыть HTTPS URL из терминала (камера требует безопасный контекст; для локальной сети — см. Vite Network).

## Сборка

```bash
npm run build
```

## Связка с GitHub

Локальная копия: `E:\BlagoGames\web-mediapipe 2 - blasters`

```bash
cd "E:\BlagoGames\web-mediapipe 2 - blasters"
git init
git branch -M main
git remote add origin https://github.com/megaigrovoy/Blasters.git
git add .
git commit -m "Initial Blasters MVP — coop pose hand blast"
git push -u origin main
```

Репозиторий должен быть создан на GitHub (пустой). Если уже есть файлы на удалёнке — перед первым push выполните `git pull origin main --rebase`.
