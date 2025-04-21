const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Размеры игрового поля
canvas.width = 600;
canvas.height = 800;

// Заглушка: отрисовка нижних ячеек для ответов
const answerCells = 4;
const cellWidth = canvas.width / answerCells;
const cellHeight = 80;

// Генерация случайного линейного уравнения с x в любой части и разным порядком членов
function generateExample() {
    // x — целое от -10 до 10
    let x = Math.floor(Math.random() * 21) - 10;
    // b — коэффициент при x, не 0
    let b = 0;
    while (b === 0) {
        b = Math.floor(Math.random() * 11) - 5;
    }
    // a, d — свободные члены
    let a = Math.floor(Math.random() * 21) - 10;
    let d = Math.floor(Math.random() * 21) - 10;
    // c — коэффициент при x справа, 0 <= |c| <= 5
    let c = 0;
    while (c === b) {
        c = Math.floor(Math.random() * 11) - 5;
    }
    // Формируем левую и правую части
    // ax + b = cx + d
    // b*x + a = c*x + d
    // Решаем: (b-c)x = d-a => x = (d-a)/(b-c)
    // Но мы хотим, чтобы x был целым, поэтому d = (b-c)*x + a
    d = (b - c) * x + a;
    // Формируем варианты записи
    let left, right;
    // Случайный порядок: x слева или справа
    if (Math.random() < 0.5) {
        // x слева
        if (Math.random() < 0.5) {
            left = `${b === 1 ? '' : (b === -1 ? '-' : b)}x${a >= 0 ? ' + ' + a : ' - ' + Math.abs(a)}`;
        } else {
            left = `${a}${b >= 0 ? ' + ' + (b === 1 ? '' : b) + 'x' : ' - ' + (Math.abs(b) === 1 ? '' : Math.abs(b)) + 'x'}`;
        }
        if (Math.random() < 0.5) {
            right = `${c === 0 ? d : (c === 1 ? '' : (c === -1 ? '-' : c)) + 'x' + (d >= 0 ? ' + ' + d : ' - ' + Math.abs(d))}`;
        } else {
            right = `${d}${c >= 0 ? ' + ' + (c === 1 ? '' : c) + 'x' : ' - ' + (Math.abs(c) === 1 ? '' : Math.abs(c)) + 'x'}`;
        }
    } else {
        // x справа
        if (Math.random() < 0.5) {
            right = `${b === 1 ? '' : (b === -1 ? '-' : b)}x${a >= 0 ? ' + ' + a : ' - ' + Math.abs(a)}`;
        } else {
            right = `${a}${b >= 0 ? ' + ' + (b === 1 ? '' : b) + 'x' : ' - ' + (Math.abs(b) === 1 ? '' : Math.abs(b)) + 'x'}`;
        }
        if (Math.random() < 0.5) {
            left = `${c === 0 ? d : (c === 1 ? '' : (c === -1 ? '-' : c)) + 'x' + (d >= 0 ? ' + ' + d : ' - ' + Math.abs(d))}`;
        } else {
            left = `${d}${c >= 0 ? ' + ' + (c === 1 ? '' : c) + 'x' : ' - ' + (Math.abs(c) === 1 ? '' : Math.abs(c)) + 'x'}`;
        }
    }
    // Убираем лишние + -
    left = left.replace(/\+ -/g, '- ').replace(/ 1x/g, ' x').replace(/ -1x/g, ' -x').replace(/\+ 0x/g, '').replace(/ 0x/g, '').replace(/\+ 0/g, '').replace(/- 0/g, '').replace(/^0 /, '').replace(/\s+/g, ' ').trim();
    right = right.replace(/\+ -/g, '- ').replace(/ 1x/g, ' x').replace(/ -1x/g, ' -x').replace(/\+ 0x/g, '').replace(/ 0x/g, '').replace(/\+ 0/g, '').replace(/- 0/g, '').replace(/^0 /, '').replace(/\s+/g, ' ').trim();
    let eq = `${left} = ${right}`;
    return { question: eq, answer: x };
}

// Генерация вариантов ответов
function generateAnswers(correctAnswer) {
    const answers = [correctAnswer];
    while (answers.length < answerCells) {
        let fake = Math.floor(Math.random() * 21) - 10;
        if (!answers.includes(fake)) {
            answers.push(fake);
        }
    }
    // Перемешиваем варианты
    return answers.sort(() => Math.random() - 0.5);
}

// Начальные параметры падающего примера
let falling = {
    ...generateExample(),
    x: 1, // всегда вторая колонка
    y: 0,
    speed: 2,
};
let answers = generateAnswers(falling.answer);

// Параметры игры
let score = 0;
let mistakes = 0;
let baseLineY = canvas.height - cellHeight; // текущая высота линии с ответами
const minLineY = 0 + cellHeight * 2; // минимально допустимая высота (проигрыш)
const maxLineY = canvas.height - cellHeight; // максимально низко
let feedback = null; // {type: 'success'|'fail', timer: number}
let gameOver = false;
let fastDropActive = false;
let level = 1;
let correctInLevel = 0;

// --- Управление для мобильных устройств ---
let lastTap = 0;
canvas.addEventListener('touchstart', function (e) {
    if (gameOver) {
        resetGame();
        return;
    }
    if (e.touches.length === 1) {
        const rect = canvas.getBoundingClientRect();
        const x = e.touches[0].clientX - rect.left;
        // Исправлено: всегда корректно выбирает самую правую колонку
        let col = Math.floor(x / (canvas.width / answerCells));
        if (col >= answerCells) col = answerCells - 1;
        falling.x = Math.max(0, Math.min(answerCells - 1, col));
        // Double tap detection
        const now = Date.now();
        if (now - lastTap < 350) {
            fastDropActive = true;
        }
        lastTap = now;
    }
});

// --- Автофокус на canvas для работы стрелок в Telegram Mini Apps ---
function setCanvasFocus() {
    if (canvas.tabIndex === undefined || canvas.tabIndex < 0) canvas.tabIndex = 0;
    canvas.focus();
}
setCanvasFocus();

function getNormalSpeed() {
    return (2 + (level - 1) * 1.2) / 2;
}
function getFastSpeed() {
    return (28 + (level - 1) * 4) / 2;
}

function resetGame() {
    score = 0;
    mistakes = 0;
    baseLineY = maxLineY;
    gameOver = false;
    level = 1;
    correctInLevel = 0;
    falling = {
        ...generateExample(),
        x: 1, // всегда вторая колонка
        y: 0,
        speed: getNormalSpeed(),
    };
    answers = generateAnswers(falling.answer);
    setTimeout(setCanvasFocus, 100); // автофокус после сброса
}

function drawHeader() {
    ctx.font = '28px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    // Очки
    ctx.fillStyle = 'green';
    ctx.fillText(`Очки: ${score}`, 20, 20);
    // Ошибки
    ctx.fillStyle = 'red';
    ctx.fillText(`Ошибки: ${mistakes}`, 180, 20);
    // Уровень
    ctx.fillStyle = '#1976d2';
    ctx.fillText(`Уровень: ${level}`, 350, 20);
}

function drawFeedback() {
    if (!feedback) return;
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = feedback.timer / 30;
    ctx.fillStyle = feedback.type === 'success' ? 'green' : 'red';
    ctx.fillText(feedback.type === 'success' ? '+1' : 'Ошибка!', canvas.width / 2, 120);
    ctx.globalAlpha = 1;
}

function drawGameOver() {
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'red';
    ctx.fillText('Игра окончена!', canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = '32px Arial';
    ctx.fillStyle = '#333';
    ctx.fillText(`Ваш счет: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
    ctx.font = '24px Arial';
    ctx.fillText('Нажмите любую клавишу для новой игры', canvas.width / 2, canvas.height / 2 + 70);
}

function drawFalling() {
    ctx.fillStyle = '#1976d2';
    ctx.font = '36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fx = falling.x * cellWidth + cellWidth / 2;
    const fy = falling.y + 40;
    // Проверяем ширину текста
    const text = falling.question;
    const textWidth = ctx.measureText(text).width;
    let drawX = fx;
    // Если текст выходит за левую границу
    if (drawX - textWidth / 2 < 0) {
        drawX = textWidth / 2 + 5;
    }
    // Если текст выходит за правую границу
    if (drawX + textWidth / 2 > canvas.width) {
        drawX = canvas.width - textWidth / 2 - 5;
    }
    ctx.fillText(text, drawX, fy);
}

function drawDino() {
    // Динозавр занимает всё пространство между низом и плашкой
    const dinoTop = baseLineY + cellHeight;
    const dinoBottom = canvas.height;
    const dinoHeight = dinoBottom - dinoTop;
    const dinoWidth = canvas.width * 0.5;
    const dinoX = canvas.width / 2 - dinoWidth / 2;
    const dinoY = dinoTop;

    // Тело (овал)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(dinoX + dinoWidth / 2, dinoY + dinoHeight * 0.7, dinoWidth / 2, dinoHeight * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#43d94a';
    ctx.fill();
    ctx.restore();

    // Живот (светлый овал)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(dinoX + dinoWidth / 2, dinoY + dinoHeight * 0.8, dinoWidth * 0.25, dinoHeight * 0.18, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#b6f7b9';
    ctx.fill();
    ctx.restore();

    // Голова (круг)
    ctx.save();
    ctx.beginPath();
    ctx.arc(dinoX + dinoWidth * 0.7, dinoY + dinoHeight * 0.25, dinoHeight * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#43d94a';
    ctx.fill();
    ctx.restore();

    // Глаз
    ctx.save();
    ctx.beginPath();
    ctx.arc(dinoX + dinoWidth * 0.8, dinoY + dinoHeight * 0.23, dinoHeight * 0.04, 0, Math.PI * 2);
    ctx.fillStyle = '#222';
    ctx.fill();
    ctx.restore();

    // Щёчка
    ctx.save();
    ctx.beginPath();
    ctx.arc(dinoX + dinoWidth * 0.75, dinoY + dinoHeight * 0.3, dinoHeight * 0.03, 0, Math.PI * 2);
    ctx.fillStyle = '#f7b6b6';
    ctx.fill();
    ctx.restore();

    // Рот (дуга)
    ctx.save();
    ctx.beginPath();
    ctx.arc(dinoX + dinoWidth * 0.8, dinoY + dinoHeight * 0.28, dinoHeight * 0.06, Math.PI * 0.15, Math.PI * 0.85);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Руки
    ctx.save();
    ctx.strokeStyle = '#43d94a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(dinoX + dinoWidth * 0.35, dinoY + dinoHeight * 0.6);
    ctx.lineTo(dinoX + dinoWidth * 0.18, dinoY + dinoHeight * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(dinoX + dinoWidth * 0.65, dinoY + dinoHeight * 0.6);
    ctx.lineTo(dinoX + dinoWidth * 0.82, dinoY + dinoHeight * 0.5);
    ctx.stroke();
    ctx.restore();

    // Ноги
    ctx.save();
    ctx.strokeStyle = '#43d94a';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(dinoX + dinoWidth * 0.45, dinoY + dinoHeight * 0.95);
    ctx.lineTo(dinoX + dinoWidth * 0.45, dinoY + dinoHeight * 1.08);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(dinoX + dinoWidth * 0.55, dinoY + dinoHeight * 0.95);
    ctx.lineTo(dinoX + dinoWidth * 0.55, dinoY + dinoHeight * 1.08);
    ctx.stroke();
    ctx.restore();

    // Хвост
    ctx.save();
    ctx.strokeStyle = '#43d94a';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(dinoX + dinoWidth * 0.1, dinoY + dinoHeight * 0.7);
    ctx.lineTo(dinoX - dinoWidth * 0.18, dinoY + dinoHeight * 0.5);
    ctx.stroke();
    ctx.restore();
}

function drawAnswerCells() {
    for (let i = 0; i < answerCells; i++) {
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(i * cellWidth, baseLineY, cellWidth, cellHeight);
        ctx.strokeStyle = '#333';
        ctx.strokeRect(i * cellWidth, baseLineY, cellWidth, cellHeight);
        // Рисуем вариант ответа
        ctx.fillStyle = '#333';
        ctx.font = '28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(answers[i], i * cellWidth + cellWidth / 2, baseLineY + cellHeight / 2);
    }
}

const GAME_VERSION = '2';

function drawVersion() {
    ctx.save();
    ctx.font = '20px Arial';
    ctx.fillStyle = '#1976d2';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('v' + GAME_VERSION, canvas.width - 12, canvas.height - 12);
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawHeader();
    drawDino();
    drawAnswerCells();
    drawFalling();
    drawFeedback();
    if (gameOver) drawGameOver();
    drawVersion();
}

function update() {
    if (gameOver) return;
    if (fastDropActive) {
        falling.y += getFastSpeed();
        if (falling.y + 40 >= baseLineY) {
            falling.y = baseLineY - 40;
            fastDropActive = false;
        }
    } else {
        falling.y += getNormalSpeed();
    }
    // Проверка: достигли ли нижней границы
    if (falling.y + 40 >= baseLineY) {
        if (answers[falling.x] === falling.answer) {
            score++;
            correctInLevel++;
            feedback = {type: 'success', timer: 30};
            if (baseLineY < maxLineY) baseLineY += cellHeight;
            if (correctInLevel >= 3) {
                level++;
                correctInLevel = 0;
            }
        } else {
            mistakes++;
            feedback = {type: 'fail', timer: 30};
            if (baseLineY > minLineY) baseLineY -= cellHeight;
        }
        if (baseLineY <= minLineY) {
            gameOver = true;
        }
        falling = {
            ...generateExample(),
            x: 1, // всегда вторая колонка
            y: 0,
            speed: getNormalSpeed(),
        };
        answers = generateAnswers(falling.answer);
        setTimeout(setCanvasFocus, 100); // автофокус после нового уравнения
    }
    if (feedback) {
        feedback.timer--;
        if (feedback.timer <= 0) feedback = null;
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();

// Управление стрелками и рестарт игры
window.addEventListener('keydown', (e) => {
    if (gameOver) {
        resetGame();
        return;
    }
    if (e.key === 'ArrowLeft') {
        falling.x = Math.max(0, falling.x - 1);
    } else if (e.key === 'ArrowRight') {
        falling.x = Math.min(answerCells - 1, falling.x + 1);
    } else if (e.key === ' ') {
        fastDropActive = true;
    }
}); 