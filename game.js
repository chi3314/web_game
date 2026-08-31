const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 音声要素の取得
const bgm0 = document.getElementById('bgm0');
const bgm1 = document.getElementById('bgm1');
const bgm2 = document.getElementById('bgm2');
const bgm3 = document.getElementById('bgm3');

// 効果音は連続再生できるようクローン関数を作成
function playMoveSound() {
    const se = bgm1.cloneNode();
    se.volume = 0.5;
    se.play().catch(e => console.log(e));
}

// 画像の読み込み
const playerImg = new Image();
playerImg.src = 'icon/turtle_icon.gif';

// ゲーム定数
const SCREEN_WIDTH = 600;
const SCREEN_HEIGHT = 600;
const TIME_LIMIT = 180;
const NUM_OBSTACLES = 5;
const ARROW_SPEED = 4;
const ESCAPE_ANGLE_RAD = (30 * Math.PI) / 180;
const COLLISION_DIST = 20;

// ゲーム変数
let gameRunning = false;
let startTime, lastArrowTime;
let obstacles = [];
let arrows = [];
let keys = {};

let player = {
    x: SCREEN_WIDTH / 2,
    y: SCREEN_HEIGHT / 2,
    angle: -Math.PI / 2, // 初期向き(上)
    isCollided: false,
    collidedObstacle: null
};

// キー入力処理
window.addEventListener('keydown', (e) => { keys[e.key] = true; });
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

// 障害物の初期化
function setupObstacles() {
    obstacles = [];
    for (let i = 0; i < NUM_OBSTACLES; i++) {
        obstacles.push({
            x: Math.random() * (SCREEN_WIDTH - 80) + 40,
            y: Math.random() * (SCREEN_HEIGHT - 80) + 40,
            size: 30
        });
    }
}

// 矢印の発射
function shootArrow() {
    if (obstacles.length === 0) return;
    const shooter = obstacles[Math.floor(Math.random() * obstacles.length)];
    const angle = Math.atan2(player.y - shooter.y, player.x - shooter.x);
    arrows.push({
        x: shooter.x,
        y: shooter.y,
        angle: angle
    });
}

// 描画系の関数
function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    
    // 画像が読み込まれていれば描画、なければ代わりの円
    if (playerImg.complete && playerImg.width > 0) {
        ctx.drawImage(playerImg, -15, -15, 30, 30);
    } else {
        ctx.fillStyle = player.isCollided ? 'red' : 'cyan';
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
    }

    // 進行方向インジケーター（赤い三角形）
    ctx.rotate(player.angle);
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.moveTo(25, 0);
    ctx.lineTo(15, -5);
    ctx.lineTo(15, 5);
    ctx.fill();
    ctx.restore();
}

function drawObstacles() {
    ctx.fillStyle = 'indigo';
    obstacles.forEach(ob => {
        ctx.fillRect(ob.x - ob.size/2, ob.y - ob.size/2, ob.size, ob.size);
    });
}

function drawArrows() {
    ctx.fillStyle = 'yellow';
    arrows.forEach(arrow => {
        ctx.save();
        ctx.translate(arrow.x, arrow.y);
        ctx.rotate(arrow.angle);
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-5, -5);
        ctx.lineTo(-5, 5);
        ctx.fill();
        ctx.restore();
    });
}

function drawTimer(remaining) {
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`Time: ${remaining}`, SCREEN_WIDTH / 2 - 40, 30);
}

// プレイヤーの移動ロジック
function updatePlayer() {
    let moved = false;
    // 回転 (1フレームあたり約3度)
    if (keys['ArrowRight']) { player.angle += 0.05; moved = true; }
    if (keys['ArrowLeft']) { player.angle -= 0.05; moved = true; }

    const speed = 3;
    let dx = 0, dy = 0;

    if (keys['ArrowUp']) {
        dx = Math.cos(player.angle) * speed;
        dy = Math.sin(player.angle) * speed;
        moved = true;
    }
    if (keys['ArrowDown']) {
        dx = -Math.cos(player.angle) * speed;
        dy = -Math.sin(player.angle) * speed;
        moved = true;
    }

    // 移動音 (間隔を間引く)
    if (moved && Math.random() < 0.1) playMoveSound();

    if (player.isCollided && (dx !== 0 || dy !== 0)) {
        const angleToObstacle = Math.atan2(player.collidedObstacle.y - player.y, player.collidedObstacle.x - player.x);
        let angleDiff = Math.abs(player.angle - angleToObstacle);
        // 角度差を0〜πの範囲に正規化
        while (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
        
        if (keys['ArrowUp'] && angleDiff <= ESCAPE_ANGLE_RAD) { dx = 0; dy = 0; }
        if (keys['ArrowDown'] && angleDiff >= (Math.PI - ESCAPE_ANGLE_RAD)) { dx = 0; dy = 0; }
    }

    player.x += dx;
    player.y += dy;

    // 画面端のワープ処理
    if (player.x > SCREEN_WIDTH) player.x = 0;
    if (player.x < 0) player.x = SCREEN_WIDTH;
    if (player.y > SCREEN_HEIGHT) player.y = 0;
    if (player.y < 0) player.y = SCREEN_HEIGHT;
}

// ゲームループ
function gameLoop() {
    if (!gameRunning) return;

    const now = Date.now();
    const elapsed = Math.floor((now - startTime) / 1000);
    const remaining = TIME_LIMIT - elapsed;

    // 勝利判定
    if (remaining <= 0) {
        endGame("GAME CLEAR!!", bgm2);
        return;
    }

    // 矢印の発射 (1.5秒間隔)
    if (now - lastArrowTime > 1500) {
        shootArrow();
        lastArrowTime = now;
    }

    // 描画クリア
    ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    drawObstacles();
    updatePlayer();

    // 当たり判定 (障害物)
    player.isCollided = false;
    for (let ob of obstacles) {
        const dist = Math.hypot(player.x - ob.x, player.y - ob.y);
        if (dist < COLLISION_DIST + ob.size/2) {
            player.isCollided = true;
            player.collidedObstacle = ob;
            break;
        }
    }

    // 矢印の更新と当たり判定
    for (let i = arrows.length - 1; i >= 0; i--) {
        let a = arrows[i];
        a.x += Math.cos(a.angle) * ARROW_SPEED;
        a.y += Math.sin(a.angle) * ARROW_SPEED;

        // プレイヤーとの衝突判定
        if (Math.hypot(player.x - a.x, player.y - a.y) < 15) {
            endGame("GAME OVER", bgm3);
            return;
        }

        // 画面外削除
        if (a.x < 0 || a.x > SCREEN_WIDTH || a.y < 0 || a.y > SCREEN_HEIGHT) {
            arrows.splice(i, 1);
        }
    }

    drawArrows();
    drawPlayer();
    drawTimer(remaining);

    requestAnimationFrame(gameLoop);
}

function endGame(message, soundNode) {
    gameRunning = false;
    bgm0.pause();
    bgm0.currentTime = 0;
    if (soundNode) soundNode.play();

    document.getElementById('resultText').textContent = message;
    document.getElementById('resultText').style.color = message === "GAME CLEAR!!" ? "#4caf50" : "#f44336";
    document.getElementById('resultScreen').classList.remove('hidden');
}

// イベントリスナー (開始/リトライボタン)
function startGame() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('resultScreen').classList.add('hidden');
    
    player.x = SCREEN_WIDTH / 2;
    player.y = SCREEN_HEIGHT / 2;
    arrows = [];
    keys = {};
    setupObstacles();

    startTime = Date.now();
    lastArrowTime = startTime;
    gameRunning = true;
    
    bgm0.currentTime = 0;
    bgm0.play().catch(e => console.log("BGM再生エラー:", e));

    requestAnimationFrame(gameLoop);
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('retryBtn').addEventListener('click', startGame);