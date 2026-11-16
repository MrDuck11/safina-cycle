const express = require('express');
const webpush = require('web-push');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Твои VAPID-ключи для пуш-уведомлений
const publicVapidKey = 'BHsZ5jw1NMA5Xe2RTZopbh-AuJ__YiYmnOit0loowrMXRKgKvmYLla-wseTDjQyRZr1-NYJUu0GWZinz5ntShPM';
const privateVapidKey = 'YcEqxTyedL2LPJ6FF9yv-Nc8tZy7YYqrC5cD8_9VjLw';

webpush.setVapidDetails(
    'mailto:ruslan@example.com',
    publicVapidKey,
    privateVapidKey
);

const DATA_FILE = path.join(__dirname, 'data.json');

let appData = {
    lastPeriod: '2026-11-01',
    cycleLength: 28,
    periodLength: 5,
    currentMood: 'Спокойно 🌿',
    lastSignal: 'Ничего',
    updatedAt: new Date(),
    ruslanSubscription: null,
    safinaSubscription: null
};

if (fs.existsSync(DATA_FILE)) {
    try {
        appData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        console.log('Ошибка чтения data.json, используем стандартные');
    }
}

function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(appData, null, 2));
}

async function sendPushNotification(subscription, title, body) {
    if (!subscription) return;
    try {
        await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
    } catch (err) {
        console.error('Ошибка отправки пуша:', err);
    }
}

app.get('/api/vapid-public-key', (req, res) => {
    res.json({ publicKey: publicVapidKey });
});

app.post('/api/subscribe', (req, res) => {
    const { role, subscription } = req.body;
    if (role === 'ruslan') appData.ruslanSubscription = subscription;
    if (role === 'safina') appData.safinaSubscription = subscription;
    saveData();
    res.status(201).json({ success: true });
});

app.get('/api/data', (req, res) => {
    res.json(appData);
});

app.post('/api/update', async (req, res) => {
    const { lastPeriod, cycleLength, periodLength, mood, signal } = req.body;
    
    if (lastPeriod) appData.lastPeriod = lastPeriod;
    if (cycleLength) appData.cycleLength = cycleLength;
    if (periodLength) appData.periodLength = periodLength;
    
    if (mood) {
        appData.currentMood = mood;
        await sendPushNotification(
            appData.ruslanSubscription,
            'Сафина отметила самочувствие ❤️',
            'Сейчас: ' + mood
        );
    }
    
    if (signal) {
        appData.lastSignal = signal;
        await sendPushNotification(
            appData.ruslanSubscription,
            '🚨 Сафина зовет тебя!',
            signal
        );
    }
    
    appData.updatedAt = new Date();
    saveData();
    res.json({ success: true, appData });
});

app.get('/ruslan', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Панель наблюдателя ❤️</title>
            <style>
                :root {
                    --bg-color: #EBF7F6;
                    --card-bg: #FFFFFF;
                    --primary: #2EC4B6;
                    --primary-dark: #1E8E83;
                    --text-main: #2D3748;
                    --text-muted: #718096;
                    --shadow: 0 12px 30px rgba(46, 196, 182, 0.12);
                    --radius: 20px;
                }
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, sans-serif; }
                body { background-color: var(--bg-color); color: var(--text-main); padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .panel-container { width: 100%; max-width: 440px; background: var(--card-bg); border-radius: var(--radius); box-shadow: var(--shadow); padding: 24px; }
                h2 { color: var(--primary-dark); margin-bottom: 6px; font-size: 1.3rem; }
                .subtitle { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px; }
                .push-btn { background: var(--primary); color: white; border: none; padding: 10px 14px; border-radius: 12px; width: 100%; font-weight: 600; cursor: pointer; margin-bottom: 18px; }
                .block { background: #F8FCFC; border: 1px solid #E2F1F0; border-radius: 14px; padding: 14px; margin-bottom: 12px; }
                .block-title { font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 5px; }
                .block-value { font-size: 1.05rem; font-weight: 700; color: var(--primary-dark); }
                .block-desc { font-size: 0.85rem; color: var(--text-main); margin-top: 4px; }
                .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .footer-time { font-size: 0.75rem; color: var(--text-muted); text-align: center; margin-top: 12px; }
            </style>
        </head>
        <body>
            <div class="panel-container">
                <h2>Панель Руслана ❤️</h2>
                <div class="subtitle">Сводка состояния Сафины в реальном времени</div>
                <button class="push-btn" id="pushBtn" onclick="subscribePush()">🔔 Включить пуш-уведомления на это устройство</button>

                <div class="block">
                    <div class="block-title">Текущая фаза цикла</div>
                    <div class="block-value" id="currentPhase">Загрузка...</div>
                    <div class="block-desc" id="phaseDetails">-</div>
                </div>

                <div class="grid-2">
                    <div class="block">
                        <div class="block-title">День цикла</div>
                        <div class="block-value" id="cycleDayInfo">-</div>
                    </div>
                    <div class="block">
                        <div class="block-title">До следующей фазы</div>
                        <div class="block-value" id="daysToNext">-</div>
                    </div>
                </div>

                <div class="block">
                    <div class="block-title">Следующая фаза</div>
                    <div class="block-value" id="nextPhaseName" style="color: #4A5568; font-size: 0.98rem;">-</div>
                </div>

                <div class="grid-2">
                    <div class="block">
                        <div class="block-title">Настроение</div>
                        <div class="block-value" style="font-size: 0.98rem;" id="moodInfo">-</div>
                    </div>
                    <div class="block">
                        <div class="block-title">Последний сигнал</div>
                        <div class="block-value" style="font-size: 0.95rem; color: #E53E3E;" id="signalInfo">-</div>
                    </div>
                </div>

                <div class="footer-time" id="updateTime">Обновление: -</div>
            </div>

            <script>
                function urlBase64ToUint8Array(base64String) {
                    const padding = '='.repeat((4 - base64String.length % 4) % 4);
                    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
                    const rawData = window.atob(base64);
                    const outputArray = new Uint8Array(rawData.length);
                    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
                    return outputArray;
                }

                async function subscribePush() {
                    if (!('serviceWorker' in navigator)) return alert('Браузер не поддерживает пуши');
                    const reg = await navigator.serviceWorker.register('/sw.js');
                    const res = await fetch('/api/vapid-public-key');
                    const { publicKey } = await res.json();

                    const sub = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(publicKey)
                    });

                    await fetch('/api/subscribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ role: 'ruslan', subscription: sub })
                    });

                    document.getElementById('pushBtn').innerText = '✅ Уведомления включены!';
                    document.getElementById('pushBtn').style.background = '#20998E';
                }

                function calculateCycleStats(lastPeriodStr, cycleLength, periodLength) {
                    const start = new Date(lastPeriodStr);
                    start.setHours(0, 0, 0, 0);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    const diffTime = today - start;
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    const cycleDay = ((diffDays % cycleLength) + cycleLength) % cycleLength + 1;
                    const ovulationDay = cycleLength - 14;

                    let currentPhase = '', phaseDetails = '', nextPhase = '', daysToNext = 0;

                    if (cycleDay <= periodLength) {
                        currentPhase = '🍓 Менструальная фаза';
                        phaseDetails = 'Дни менструации. Окружи её заботой и теплом.';
                        nextPhase = 'Фолликулярная фаза';
                        daysToNext = periodLength - cycleDay + 1;
                    } else if (cycleDay < ovulationDay - 1) {
                        currentPhase = '🌿 Фолликулярная фаза';
                        phaseDetails = 'Энергия растет, отличное самочувствие.';
                        nextPhase = 'Овуляция ✨';
                        daysToNext = (ovulationDay - 1) - cycleDay;
                    } else if (cycleDay >= ovulationDay - 1 && cycleDay <= ovulationDay + 1) {
                        currentPhase = '🦋 Овуляция (Пик)';
                        phaseDetails = 'Максимум энергии и прекрасного настроения!';
                        nextPhase = 'Лютеиновая фаза';
                        daysToNext = (ovulationDay + 1) - cycleDay >= 0 ? 1 : 0;
                    } else if (cycleDay >= cycleLength - 5) {
                        currentPhase = '🕯️ Лютеиновая фаза (ПМС)';
                        phaseDetails = 'Возможна усталость или чувствительность. Будь рядом ❤️';
                        nextPhase = 'Менструация (новый цикл)';
                        daysToNext = cycleLength - cycleDay + 1;
                    } else {
                        currentPhase = '🍵 Лютеиновая фаза';
                        phaseDetails = 'Спокойный, ровный период цикла.';
                        nextPhase = 'ПМС фаза';
                        daysToNext = (cycleLength - 5) - cycleDay;
                    }

                    return {
                        cycleDay, currentPhase, phaseDetails, nextPhase,
                        daysToNext: daysToNext > 0 ? 'Через ' + daysToNext + ' дн.' : 'Скоро смена фазы'
                    };
                }

                async function fetchStatus() {
                    try {
                        const res = await fetch('/api/data');
                        const data = await res.json();
                        const stats = calculateCycleStats(data.lastPeriod, data.cycleLength, data.periodLength);

                        document.getElementById('currentPhase').innerText = stats.currentPhase;
                        document.getElementById('phaseDetails').innerText = stats.phaseDetails;
                        document.getElementById('cycleDayInfo').innerText = 'День ' + stats.cycleDay + ' из ' + data.cycleLength;
                        document.getElementById('daysToNext').innerText = stats.daysToNext;
                        document.getElementById('nextPhaseName').innerText = stats.nextPhase;
                        document.getElementById('moodInfo').innerText = data.currentMood;
                        document.getElementById('signalInfo').innerText = data.lastSignal;
                        document.getElementById('updateTime').innerText = 'Обновлено: ' + new Date(data.updatedAt).toLocaleTimeString();
                    } catch (e) {}
                }

                fetchStatus();
                setInterval(fetchStatus, 3000);
            </script>
        </body>
        </html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Сервер запущен на порту ' + PORT));