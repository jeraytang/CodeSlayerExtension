import * as vscode from 'vscode';
import * as path from 'path';

interface GameState {
    type: string;
    codeCount?: number;
    comboCount?: number;
    enemyCount?: number;
    enemySpawned?: number;
    enemyKilled?: number;
    isBossKill?: boolean;
    hasBoss?: boolean;
    bossHP?: number;
    bossMaxHP?: number;
    errorFixed?: number;
}

export class GamePanel {
    private panel: vscode.WebviewPanel;
    private extensionUri: vscode.Uri;
    private _onDidDispose: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public currentState: GameState | undefined;
    private storedMaxCombo = 0;
    private totalKills = 0;

    constructor(extensionUri: vscode.Uri) {
        this.extensionUri = extensionUri;
        this.currentState = undefined;
        
        this.panel = vscode.window.createWebviewPanel(
            'codeSlayerGame',
            'Code Slayer',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getHtmlContent();
        
        this.panel.onDidDispose(() => {
            this._onDidDispose.fire();
        });
    }

    get onDidDispose(): vscode.Event<void> {
        return this._onDidDispose.event;
    }

    updateGameState(state: GameState) {
        this.currentState = state;
        
        const message = this.getGameUpdateMessage(state);
        this.panel.webview.postMessage(message);
    }

    private getGameUpdateMessage(state: GameState): string {
        switch (state.type) {
            case 'start':
                return `updateGame(${JSON.stringify({
                    combo: 0,
                    enemies: 0,
                    codeCount: 0,
                    bossHP: 0,
                    maxCombo: 0,
                    totalKills: 0,
                    message: '游戏开始！写代码召唤敌人！'
                })})`;
            
            case 'codeWritten':
                return `spawnEnemies(${JSON.stringify({
                    enemySpawned: state.enemySpawned || 0,
                    hasBoss: state.hasBoss || false,
                    codeCount: state.codeCount || 0
                })})`;
            
            case 'slay':
                return `slayEnemy(${JSON.stringify({
                    combo: state.comboCount || 0,
                    killed: state.enemyKilled || 1,
                    isBossKill: state.isBossKill || false,
                    hasBoss: state.hasBoss || false,
                    bossHP: state.bossHP || 0,
                    bossMaxHP: state.bossMaxHP || 5
                })})`;
            
            case 'errorFixed':
                return `errorFixed(${JSON.stringify({
                    errorFixed: state.errorFixed || 1
                })})`;
            
            case 'perfectSave':
                return `perfectSave()`;
            
            default:
                return '';
        }
    }

    private getStoredMaxCombo(): number {
        return this.storedMaxCombo;
    }

    private storeMaxCombo(combo: number): void {
        this.storedMaxCombo = combo;
    }

    private getTotalKills(kills: number): number {
        this.totalKills += kills;
        return this.totalKills;
    }

    dispose() {
        this.panel.dispose();
        this._onDidDispose.dispose();
    }

    private getHtmlContent(): string {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Slayer</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        audio {
            display: none;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            color: #fff;
            overflow: hidden;
        }
        
        .game-container {
            padding: 20px;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .header {
            text-align: center;
            margin-bottom: 20px;
        }
        
        .title {
            font-size: 2.5em;
            color: #e94560;
            text-shadow: 0 0 20px rgba(233, 69, 96, 0.5);
            margin-bottom: 10px;
        }
        
        .stats {
            display: flex;
            justify-content: space-around;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 20px;
        }
        
        .stat {
            text-align: center;
        }
        
        .stat-value {
            font-size: 2em;
            color: #00d9ff;
            font-weight: bold;
        }
        
        .stat-label {
            font-size: 0.9em;
            color: #aaa;
        }
        
        .combo-display {
            text-align: center;
            font-size: 3em;
            color: #ffd700;
            text-shadow: 0 0 30px rgba(255, 215, 0, 0.7);
            margin: 20px 0;
            min-height: 80px;
        }
        
        .battlefield {
            flex: 1;
            position: relative;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 10px;
            overflow: hidden;
        }
        
        .enemy {
            position: absolute;
            font-size: 2em;
            animation: float 2s ease-in-out infinite;
            cursor: pointer;
            transition: transform 0.1s;
        }
        
        .enemy:hover {
            transform: scale(1.2);
        }
        
        .enemy.boss {
            font-size: 6em;
            color: #e94560;
            animation: bossFloat 1s ease-in-out infinite;
            text-shadow: 0 0 20px rgba(233, 69, 96, 0.8);
            border: 3px solid #e94560;
            border-radius: 50%;
            padding: 10px;
            background: rgba(233, 69, 96, 0.2);
        }
        
        .enemy.armored {
            font-size: 2.5em;
            color: #ffd700;
            animation: float 2s ease-in-out infinite;
            text-shadow: 0 0 15px rgba(255, 215, 0, 0.6);
            border: 2px solid #ffd700;
            border-radius: 50%;
            padding: 5px;
            background: rgba(255, 215, 0, 0.1);
        }
        
        .enemy.magic {
            font-size: 2.5em;
            color: #8a2be2;
            animation: float 2s ease-in-out infinite;
            text-shadow: 0 0 15px rgba(138, 43, 226, 0.6);
            border: 2px solid #8a2be2;
            border-radius: 50%;
            padding: 5px;
            background: rgba(138, 43, 226, 0.1);
        }
        
        .enemy.slime {
            font-size: 2.5em;
            color: #32cd32;
            animation: float 3s ease-in-out infinite;
            text-shadow: 0 0 15px rgba(50, 205, 50, 0.6);
            border: 2px solid #32cd32;
            border-radius: 50%;
            padding: 5px;
            background: rgba(50, 205, 50, 0.1);
        }
        
        .flash-effect {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 10em;
            color: #ffd700;
            text-shadow: 0 0 50px rgba(255, 215, 0, 0.8);
            animation: flash 1s ease-out;
            z-index: 1000;
        }
        
        .clear-effect {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 15em;
            color: #00ff00;
            text-shadow: 0 0 50px rgba(0, 255, 0, 0.8);
            animation: clear 1.5s ease-out;
            z-index: 1000;
        }
        
        @keyframes flash {
            0% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.1);
            }
            50% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1.2);
            }
            100% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(2);
            }
        }
        
        @keyframes clear {
            0% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.1);
            }
            50% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1.1);
            }
            100% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(3);
            }
        }
        
        .slash-effect {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 300px;
            height: 10px;
            background: linear-gradient(90deg, transparent, #ffd700, transparent);
            transform: translate(-50%, -50%) rotate(45deg);
            border-radius: 5px;
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
            animation: slash 1s ease-out;
            z-index: 999;
        }
        
        @keyframes slash {
            0% {
                opacity: 0;
                transform: translate(-50%, -50%) rotate(45deg) scaleX(0);
            }
            50% {
                opacity: 1;
                transform: translate(-50%, -50%) rotate(45deg) scaleX(1);
            }
            100% {
                opacity: 0;
                transform: translate(-50%, -50%) rotate(45deg) scaleX(0);
            }
        }
        
        .screen-crack {
            position: absolute;
            height: 2px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 1px;
            opacity: 0;
            animation: crack 1.5s ease-out;
            z-index: 1001;
            pointer-events: none;
        }
        
        @keyframes crack {
            0% {
                opacity: 0;
                transform: scale(0);
            }
            30% {
                opacity: 1;
                transform: scale(1);
            }
            100% {
                opacity: 0;
                transform: scale(1.2);
            }
        }
        
        /* 虚空斩击特效 - 增强版 */
        .void-sword {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 300px;
            height: 15px;
            background: linear-gradient(90deg, transparent, #fff, #ffd700, #fff, transparent);
            border-radius: 8px;
            box-shadow: 
                0 0 20px #ffd700,
                0 0 40px #ffd700,
                0 0 60px rgba(255, 215, 0, 0.8),
                0 0 80px rgba(255, 215, 0, 0.6),
                0 0 100px rgba(138, 43, 226, 0.4);
            transform: translate(-50%, -50%) rotate(-45deg) scale(0);
            animation: voidSword 0.3s ease-out forwards;
            z-index: 1002;
        }
        
        @keyframes voidSword {
            0% {
                transform: translate(-50%, -50%) rotate(-45deg) scale(0);
                opacity: 0;
                filter: blur(10px);
            }
            50% {
                opacity: 1;
                filter: blur(2px);
            }
            100% {
                transform: translate(-50%, -50%) rotate(-45deg) scale(1);
                opacity: 1;
                filter: blur(0);
            }
        }
        
        /* 冲击波效果 */
        .shockwave {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255, 215, 0, 0.8) 0%, rgba(255, 215, 0, 0) 70%);
            transform: translate(-50%, -50%) scale(0);
            animation: shockwave 1.5s ease-out;
            z-index: 1001;
        }
        
        @keyframes shockwave {
            0% {
                transform: translate(-50%, -50%) scale(0);
                opacity: 1;
            }
            100% {
                transform: translate(-50%, -50%) scale(50);
                opacity: 0;
            }
        }
        
        .void-slash {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, transparent 45%, rgba(255, 255, 255, 0.9) 48%, rgba(255, 215, 0, 1) 50%, rgba(255, 255, 255, 0.9) 52%, transparent 55%);
            opacity: 0;
            animation: voidSlash 0.3s ease-out;
            z-index: 1003;
        }
        
        @keyframes voidSlash {
            0% {
                opacity: 0;
                transform: scaleX(0) scaleY(1);
            }
            30% {
                opacity: 1;
                transform: scaleX(0.5) scaleY(1.5);
            }
            100% {
                opacity: 0;
                transform: scaleX(2) scaleY(0.5);
            }
        }
        
        .void-fragment {
            position: absolute;
            background: linear-gradient(135deg, rgba(138, 43, 226, 0.9), rgba(255, 215, 0, 0.9));
            border: 1px solid rgba(255, 255, 255, 0.8);
            border-radius: 3px;
            box-shadow: 
                0 0 10px rgba(255, 215, 0, 0.8),
                0 0 20px rgba(138, 43, 226, 0.6),
                inset 0 0 10px rgba(255, 255, 255, 0.3);
            opacity: 0;
            animation: voidFragment 1.5s ease-out;
            z-index: 1004;
        }
        
        @keyframes voidFragment {
            0% {
                opacity: 0;
                transform: scale(0) rotate(0deg) translateX(0) translateY(0);
            }
            15% {
                opacity: 1;
                transform: scale(1) rotate(20deg) translateX(10px) translateY(-10px);
            }
            85% {
                opacity: 1;
                transform: scale(1.5) rotate(270deg) translateX(100px) translateY(-200px);
            }
            100% {
                opacity: 0;
                transform: scale(2) rotate(360deg) translateX(200px) translateY(-300px);
            }
        }
        
        .void-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 5em;
            font-family: 'SimSun', serif;
            color: #ffd700;
            text-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 0 50px rgba(138, 43, 226, 0.6);
            opacity: 0;
            animation: voidText 1.5s ease-out;
            z-index: 1005;
        }
        
        @keyframes voidText {
            0% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.5);
            }
            50% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1.1);
            }
            100% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(2);
            }
        }
        

        
        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
        }
        
        @keyframes bossFloat {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-30px) scale(1.1); }
        }
        
        .slay-effect {
            position: absolute;
            font-size: 3em;
            color: #ff0000;
            animation: slayAnim 0.5s ease-out forwards;
            pointer-events: none;
        }
        
        @keyframes slayAnim {
            0% { opacity: 1; transform: scale(1) rotate(0deg); }
            100% { opacity: 0; transform: scale(2) rotate(360deg); }
        }
        
        .message {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            padding: 20px 40px;
            border-radius: 10px;
            font-size: 1.5em;
            animation: fadeInOut 2s ease-in-out;
            pointer-events: none;
        }
        
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
            20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            80% { opacity: 1; }
            100% { opacity: 0; }
        }
        
        .controls {
            margin-top: 20px;
            text-align: center;
            padding: 15px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
        }
        
        .key-hint {
            font-size: 1.2em;
            color: #00d9ff;
        }
        
        .key {
            display: inline-block;
            background: #333;
            padding: 5px 15px;
            border-radius: 5px;
            border: 2px solid #00d9ff;
            margin: 0 5px;
        }
        
        .achievements {
            margin-top: 20px;
            padding: 15px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
        }
        
        .achievements h3 {
            color: #ffd700;
            margin-bottom: 10px;
        }
        
        .achievement {
            display: inline-block;
            background: rgba(255, 215, 0, 0.2);
            padding: 5px 15px;
            margin: 5px;
            border-radius: 20px;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="game-container">
        <div class="header">
            <h1 class="title">⚔️ Code Slayer ⚔️</h1>
        </div>
        <audio id="spawnSound" src="data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAADAAAGhgAChoAAAAVAAADIAAAI5AAACjAEAAP/xAAANAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAA8AAAAAwAAAYYAACqAAAAWAAAAMgAAAIQAAACcBAAAbqAAATGF2YzU4Ljc2LjEwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQwAAAAAAAAAAAAEluZm8AAAA8AAAAAwAAAYYAACqAAAAWAAAAMgAAAIQAAACcBAAAbqAAATGF2YzU4Ljc2LjEwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"></audio>
        <audio id="killSound" src="data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAADAAAGhgAChoAAAAVAAADIAAAI5AAACjAEAAP/xAAANAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAA8AAAAAwAAAYYAACqAAAAWAAAAMgAAAIQAAACcBAAAbqAAATGF2YzU4Ljc2LjEwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQwAAAAAAAAAAAAEluZm8AAAA8AAAAAwAAAYYAACqAAAAWAAAAMgAAAIQAAACcBAAAbqAAATGF2YzU4Ljc2LjEwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"></audio>
        <audio id="bossSpawnSound" src="data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAADAAAGhgAChoAAAAVAAADIAAAI5AAACjAEAAP/xAAANAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAA8AAAAAwAAAYYAACqAAAAWAAAAMgAAAIQAAACcBAAAbqAAATGF2YzU4Ljc2LjEwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQwAAAAAAAAAAAAEluZm8AAAA8AAAAAwAAAYYAACqAAAAWAAAAMgAAAIQAAACcBAAAbqAAATGF2YzU4Ljc2LjEwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"></audio>
        <audio id="bossKillSound" src="data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAADAAAGhgAChoAAAAVAAADIAAAI5AAACjAEAAP/xAAANAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAA8AAAAAwAAAYYAACqAAAAWAAAAMgAAAIQAAACcBAAAbqAAATGF2YzU4Ljc2LjEwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQwAAAAAAAAAAAAEluZm8AAAA8AAAAAwAAAYYAACqAAAAWAAAAMgAAAIQAAACcBAAAbqAAATGF2YzU4Ljc2LjEwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"></audio>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-value" id="combo">0</div>
                <div class="stat-label">连击数</div>
            </div>
            <div class="stat">
                <div class="stat-value" id="enemies">0</div>
                <div class="stat-label">敌人数量</div>
            </div>
            <div class="stat">
                <div class="stat-value" id="codeCount">0</div>
                <div class="stat-label">代码字数</div>
            </div>
            <div class="stat">
                <div class="stat-value" id="maxCombo">0</div>
                <div class="stat-label">最高连击</div>
            </div>
            <div class="stat">
                <div class="stat-value" id="bossHP">-</div>
                <div class="stat-label">Boss血量</div>
            </div>
            <div class="stat">
                <div class="stat-value" id="totalKills">0</div>
                <div class="stat-label">击杀数</div>
            </div>
        </div>
        
        <div class="combo-display" id="comboDisplay"></div>
        
        <div class="battlefield" id="battlefield">
        </div>
        
        <div class="controls">
            <div class="key-hint">
                在代码区按 <span class="key">Ctrl</span> + <span class="key">S</span> 保存并攻击
            </div>
        </div>
        
        <div class="achievements">
            <h3>🏆 成就</h3>
            <span class="achievement" id="ach1">初出茅庐 (5连击)</span>
            <span class="achievement" id="ach2">连击达人 (20连击)</span>
            <span class="achievement" id="ach3">Boss猎人 (击杀Boss)</span>
            <span class="achievement" id="ach4">代码狂人 (写1000行)</span>
        </div>
    </div>

    <script>
        let enemies = [];
        let combo = 0;
        let maxCombo = 0;
        let totalKills = 0;
        let codeCount = 0;
        let bossHP = 0;
        let bossMaxHP = 100;
        
        function playSound(soundId) {
            const sound = document.getElementById(soundId);
            if (sound) {
                sound.currentTime = 0;
                sound.play().catch(e => console.log('Audio play failed:', e));
            }
        }
        
        const battlefield = document.getElementById('battlefield');
        const comboDisplay = document.getElementById('comboDisplay');
        
        const enemyEmojis = ['👹', '👻', '💀', '👾', '🤖', '👽', '🎃', '🦇', '🕷️', '🦂'];
        const bossEmojis = ['🐛', '🦠', '🧟', '👹', '💀'];
        
        function updateUI() {
            document.getElementById('combo').textContent = combo;
            document.getElementById('enemies').textContent = enemies.length;
            document.getElementById('codeCount').textContent = codeCount;
            document.getElementById('maxCombo').textContent = maxCombo;
            document.getElementById('bossHP').textContent = bossHP > 0 ? bossHP + '/' + bossMaxHP : '-';
            document.getElementById('totalKills').textContent = totalKills;
            
            if (combo > 0) {
                comboDisplay.textContent = combo > 1 ? combo + ' 连击！' : '1 连击！';
            } else {
                comboDisplay.textContent = '';
            }
            
            checkAchievements();
        }
        
        function spawnEnemy(count, hasBoss) {
            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    const enemy = document.createElement('div');
                    enemy.className = 'enemy';
                    enemy.textContent = enemyEmojis[Math.floor(Math.random() * enemyEmojis.length)];
                    enemy.style.left = Math.random() * 80 + '%';
                    enemy.style.top = Math.random() * 60 + 20 + '%';
                    enemy.onclick = () => slayClick();
                    battlefield.appendChild(enemy);
                    enemies.push(enemy);
                    playSound('spawnSound');
                    updateUI();
                }, i * 200);
            }
            
            if (hasBoss) {
                setTimeout(() => {
                    spawnBoss();
                }, count * 200);
            }
        }
        
        function spawnBoss() {
            const existingBoss = document.querySelector('.enemy.boss');
            if (existingBoss) { return; }
            
            const boss = document.createElement('div');
            boss.className = 'enemy boss';
            boss.textContent = bossEmojis[Math.floor(Math.random() * bossEmojis.length)];
            boss.style.left = '40%';
            boss.style.top = '30%';
            bossHP = 100;
            bossMaxHP = 100;
            battlefield.appendChild(boss);
            enemies.push(boss);
            playSound('bossSpawnSound');
            showMessage('🔥 BOSS出现！');
            updateUI();
        }
        
        function slayClick() {
            if (enemies.length > 0) {
                combo++;
                if (combo > maxCombo) { maxCombo = combo; }
                totalKills++;
                
                const enemy = enemies.pop();
                if (enemy) {
                    showSlayEffect(enemy);
                    enemy.remove();
                    if (enemy.classList.contains('boss')) {
                        playSound('bossKillSound');
                    } else {
                        playSound('killSound');
                    }
                }
                updateUI();
            }
        }
        
        function showSlayEffect(element) {
            const rect = element.getBoundingClientRect();
            const bfRect = battlefield.getBoundingClientRect();
            const effect = document.createElement('div');
            effect.className = 'slay-effect';
            effect.textContent = '💥';
            effect.style.left = (rect.left - bfRect.left) + 'px';
            effect.style.top = (rect.top - bfRect.top) + 'px';
            battlefield.appendChild(effect);
            setTimeout(() => effect.remove(), 500);
        }
        
        function showMessage(text) {
            const msg = document.createElement('div');
            msg.className = 'message';
            msg.textContent = text;
            battlefield.appendChild(msg);
            setTimeout(() => msg.remove(), 2000);
        }
        
        function checkAchievements() {
            if (combo >= 5) {
                document.getElementById('ach1').style.background = 'rgba(0, 255, 0, 0.3)';
            }
            if (combo >= 20) {
                document.getElementById('ach2').style.background = 'rgba(0, 255, 0, 0.3)';
            }
            if (codeCount >= 1000) {
                document.getElementById('ach4').style.background = 'rgba(0, 255, 0, 0.3)';
            }
        }
        
        function updateGame(data) {
            combo = data.combo || 0;
            codeCount = data.codeCount || codeCount;
            maxCombo = data.maxCombo || maxCombo;
            totalKills = data.totalKills || totalKills;
            bossHP = data.bossHP || 0;
            bossMaxHP = data.bossMaxHP || bossMaxHP;
            updateUI();
        }
        
        function handleSpawnEnemies(data) {
            codeCount = data.codeCount || codeCount;
            bossHP = data.bossHP || bossHP;
            bossMaxHP = data.bossMaxHP || bossMaxHP;
            // 根据data.enemySpawned生成敌人
            spawnEnemy(data.enemySpawned || 0, data.hasBoss || false);
        }
        
        function handleSlayEnemy(data) {
            if (data.isBossKill) {
                const boss = document.querySelector('.enemy.boss');
                if (boss) {
                    showSlayEffect(boss);
                    boss.remove();
                    const bossIndex = enemies.findIndex(enemy => enemy.classList.contains('boss'));
                    if (bossIndex !== -1) {
                        enemies.splice(bossIndex, 1);
                    }
                    playSound('bossKillSound');
                    showMessage('💀 BOSS击杀！');
                    document.getElementById('ach3').style.background = 'rgba(0, 255, 0, 0.3)';
                }
                bossHP = 0;
                totalKills++;
            } else {
                if (data.hasBoss) {
                    bossHP = data.bossHP;
                    bossMaxHP = data.bossMaxHP;
                    playSound('killSound');
                    showSlayEffect(document.body);
                    showMessage('🩸 Boss受击！剩余 ' + bossHP + '/' + bossMaxHP);
                    totalKills++;
                } else {
                    // 检查是否有敌人可以击杀
                    if (enemies.length === 0) {
                        showMessage('没有敌人可以击杀！');
                        return;
                    }
                    
                    const killedCount = data.killed || 1;
                    for (let i = 0; i < killedCount && enemies.length > 0; i++) {
                        const enemy = enemies.pop();
                        if (enemy) {
                            showSlayEffect(enemy);
                            enemy.remove();
                            totalKills++;
                        }
                    }
                    playSound('killSound');
                }
            }
            
            combo = data.combo || 0;
            if (combo > maxCombo) { maxCombo = combo; }
            updateUI();
        }
        
        function handleErrorFixed(data) {
            // Flash effect
            const errorFixed = data.errorFixed || 1;
            playSound('killSound');
            
            // Create flash effect (no text)
            const flash = document.createElement('div');
            flash.className = 'flash-effect';
            battlefield.appendChild(flash);
            
            // Remove after animation
            setTimeout(() => {
                flash.remove();
            }, 1000);
            
            updateUI();
        }
        
        function handlePerfectSave() {
            // Check if there are enemies
            const hasEnemies = enemies.length > 0;
            
            // Play sound only if there are enemies
            if (hasEnemies) {
                playSound('bossKillSound');
            }
            
            // Clear all enemies
            while (enemies.length > 0) {
                const enemy = enemies.pop();
                if (enemy) {
                    showSlayEffect(enemy);
                    enemy.remove();
                    totalKills++;
                }
            }
            
            // Create void slash effect
            createVoidSlashEffect();
            
            // Add combo bonus
            if (hasEnemies) {
                combo += 10;
                if (combo > maxCombo) {
                    maxCombo = combo;
                }
            }
            
            updateUI();
        }
        
        function createVoidSlashEffect() {
            // 获取战场尺寸
            const rect = battlefield.getBoundingClientRect();
            let width = rect.width;
            let height = rect.height;
            
            // 如果尺寸为0，使用默认值
            if (width === 0 || height === 0) {
                width = 800;
                height = 600;
            }
            
            // 创建Canvas
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.zIndex = '1500';
            canvas.style.pointerEvents = 'none';
            battlefield.appendChild(canvas);
            
            const ctx = canvas.getContext('2d');
            
            // 刀光参数 - 从左上到右下
            const slashX1 = -100;
            const slashY1 = -100;
            const slashX2 = width + 100;
            const slashY2 = height + 100;
            
            // 计算刀光长度
            const dx = slashX2 - slashX1;
            const dy = slashY2 - slashY1;
            const len = Math.sqrt(dx * dx + dy * dy);
            
            // 存储碎片数据
            const fragments = [];
            const fragmentCount = 150; // 碎片数量
            
            // 初始化碎片
            for (let i = 0; i < fragmentCount; i++) {
                const t = Math.random();
                const x = slashX1 + t * (slashX2 - slashX1);
                const y = slashY1 + t * (slashY2 - slashY1);
                
                // 计算法线方向（垂直于刀光）
                const nx = -dy / len;
                const ny = dx / len;
                
                // 碎片向法线两侧飞散
                const side = Math.random() > 0.5 ? 1 : -1;
                const speed = 200 + Math.random() * 400;
                
                fragments.push({
                    x: x + (Math.random() - 0.5) * 50,
                    y: y + (Math.random() - 0.5) * 50,
                    vx: nx * side * speed + (Math.random() - 0.5) * 100,
                    vy: ny * side * speed + (Math.random() - 0.5) * 100,
                    rotation: Math.random() * Math.PI * 2,
                    rotationSpeed: (Math.random() - 0.5) * 10,
                    size: 30 + Math.random() * 80,
                    alpha: 1,
                    delay: Math.random() * 100
                });
            }
            
            // 动画状态
            let slashProgress = 0;
            let slashTrail = [];
            let startTime = null;
            let messageShown = false;
            
            // 绘制刀光和碎片
            function animate(timestamp) {
                if (!startTime) startTime = timestamp;
                const elapsed = timestamp - startTime;
                
                // 清空画布
                ctx.clearRect(0, 0, width, height);
                
                // 刀光动画 (0-400ms)
                if (elapsed < 400) {
                    slashProgress = Math.min(1, elapsed / 300);
                    
                    // 添加新的刀光位置到轨迹
                    const currentX = slashX1 + slashProgress * (slashX2 - slashX1);
                    const currentY = slashY1 + slashProgress * (slashY2 - slashY1);
                    
                    slashTrail.push({ x: currentX, y: currentY, alpha: 1 });
                    
                    // 限制轨迹长度
                    if (slashTrail.length > 30) {
                        slashTrail.shift();
                    }
                    
                    // 绘制刀光轨迹（拖尾效果）
                    for (let i = 0; i < slashTrail.length; i++) {
                        const point = slashTrail[i];
                        const trailAlpha = (i / slashTrail.length) * 0.8;
                        const trailWidth = (i / slashTrail.length) * 30 + 5;
                        
                        // 外发光
                        ctx.beginPath();
                        ctx.moveTo(point.x - (slashX2 - slashX1) / len * 50, point.y - (slashY2 - slashY1) / len * 50);
                        ctx.lineTo(point.x + (slashX2 - slashX1) / len * 50, point.y + (slashY2 - slashY1) / len * 50);
                        ctx.strokeStyle = 'rgba(255, 215, 0, ' + (trailAlpha * 0.3) + ')';
                        ctx.lineWidth = trailWidth + 20;
                        ctx.stroke();
                        
                        // 核心亮线
                        ctx.beginPath();
                        ctx.moveTo(point.x - (slashX2 - slashX1) / len * 50, point.y - (slashY2 - slashY1) / len * 50);
                        ctx.lineTo(point.x + (slashX2 - slashX1) / len * 50, point.y + (slashY2 - slashY1) / len * 50);
                        ctx.strokeStyle = 'rgba(255, 255, 255, ' + trailAlpha + ')';
                        ctx.lineWidth = trailWidth;
                        ctx.stroke();
                    }
                    
                    // 刀光头部 - 超亮
                    if (slashProgress < 1) {
                        const headX = currentX;
                        const headY = currentY;
                        
                        // 外层橙色光晕
                        const gradient = ctx.createRadialGradient(headX, headY, 0, headX, headY, 80);
                        gradient.addColorStop(0, 'rgba(255, 215, 0, 1)');
                        gradient.addColorStop(0.3, 'rgba(255, 140, 0, 0.8)');
                        gradient.addColorStop(0.6, 'rgba(255, 69, 0, 0.4)');
                        gradient.addColorStop(1, 'rgba(138, 43, 226, 0)');
                        
                        ctx.beginPath();
                        ctx.arc(headX, headY, 80, 0, Math.PI * 2);
                        ctx.fillStyle = gradient;
                        ctx.fill();
                        
                        // 白色核心
                        ctx.beginPath();
                        ctx.arc(headX, headY, 15, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
                        ctx.fill();
                    }
                }
                
                // 碎片动画 (200ms后开始)
                const fragmentElapsed = elapsed - 200;
                if (fragmentElapsed > 0) {
                    for (const frag of fragments) {
                        const fElapsed = fragmentElapsed - frag.delay;
                        if (fElapsed < 0) continue;
                        
                        const t = fElapsed / 1000; // 1秒动画
                        
                        // 更新位置（带物理效果）
                        const easeOut = 1 - Math.pow(1 - Math.min(t, 1), 3);
                        const x = frag.x + frag.vx * easeOut * 0.5;
                        const y = frag.y + frag.vy * easeOut * 0.5 + 500 * t * t; // 重力效果
                        const rotation = frag.rotation + frag.rotationSpeed * t;
                        const alpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
                        
                        // 绘制碎片
                        ctx.save();
                        ctx.translate(x, y);
                        ctx.rotate(rotation);
                        
                        // 碎片形状（不规则多边形）
                        const s = frag.size;
                        ctx.beginPath();
                        ctx.moveTo(-s/2, -s/3);
                        ctx.lineTo(s/3, -s/2);
                        ctx.lineTo(s/2, s/4);
                        ctx.lineTo(-s/4, s/2);
                        ctx.lineTo(-s/3, s/4);
                        ctx.closePath();
                        
                        // 橙红色烧灼边缘
                        ctx.shadowColor = '#ff4500';
                        ctx.shadowBlur = 20;
                        ctx.strokeStyle = 'rgba(255, 69, 0, ' + alpha + ')';
                        ctx.lineWidth = 3;
                        ctx.stroke();
                        
                        // 蓝色冷边
                        ctx.shadowColor = '#00bfff';
                        ctx.shadowBlur = 15;
                        ctx.strokeStyle = 'rgba(0, 191, 255, ' + (alpha * 0.7) + ')';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        
                        // 碎片内部
                        ctx.fillStyle = 'rgba(20, 20, 30, ' + alpha + ')';
                        ctx.fill();
                        
                        ctx.restore();
                    }
                }
                
                // 裂纹效果（刀光经过后）
                if (elapsed > 200 && elapsed < 2000) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.lineWidth = 2;
                    
                    // 绘制从刀光发出的裂纹
                    for (let i = 0; i < 20; i++) {
                        const t = Math.random();
                        const x = slashX1 + t * (slashX2 - slashX1);
                        const y = slashY1 + t * (slashY2 - slashY1);
                        
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        
                        // 向两侧发射裂纹
                        const angle = Math.atan2(slashY2 - slashY1, slashX2 - slashX1) + Math.PI / 2;
                        const len = 50 + Math.random() * 150;
                        
                        ctx.lineTo(
                            x + Math.cos(angle) * len * (Math.random() > 0.5 ? 1 : -1),
                            y + Math.sin(angle) * len * (Math.random() > 0.5 ? 1 : -1)
                        );
                        ctx.stroke();
                    }
                }
                
                // 清理完成消息（在动画结束前显示）
                if (elapsed > 1500 && elapsed < 2000) {
                    // 只显示一次
                    if (!messageShown) {
                        showMessage('清理完成');
                        messageShown = true;
                    }
                }
                
                // 继续动画或结束
                if (elapsed < 2000) {
                    requestAnimationFrame(animate);
                } else {
                    // 清理
                    battlefield.removeChild(canvas);
                }
            }
            
            // 开始动画
            requestAnimationFrame(animate);
        }
        

        
        function createScreenCrackEffect() {
            const crackCount = 8; // Number of cracks
            
            for (let i = 0; i < crackCount; i++) {
                const crack = document.createElement('div');
                crack.className = 'screen-crack';
                
                // Random crack position and rotation
                const x = Math.random() * 100;
                const y = Math.random() * 100;
                const rotation = Math.random() * 360;
                const length = 50 + Math.random() * 100;
                
                crack.style.left = x + '%';
                crack.style.top = y + '%';
                crack.style.width = length + 'px';
                crack.style.transform = 'rotate(' + rotation + 'deg)';
                
                battlefield.appendChild(crack);
                
                // Remove crack after animation
                setTimeout(() => {
                    if (crack) {
                        crack.remove();
                    }
                }, 1500);
            }
        }
        
        function createSlashEffect() {
            // Create a slash effect similar to fruit ninja
            const slash = document.createElement('div');
            slash.className = 'slash-effect';
            battlefield.appendChild(slash);
            
            // Animation will be handled by CSS
            
            // Remove after animation
            setTimeout(() => {
                slash.remove();
            }, 1000);
        }
        
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.startsWith('updateGame(')) {
                const data = JSON.parse(message.slice(11, -1));
                updateGame(data);
            } else if (message.startsWith('spawnEnemies(')) {
                const data = JSON.parse(message.slice(13, -1));
                handleSpawnEnemies(data);
            } else if (message.startsWith('slayEnemy(')) {
                const data = JSON.parse(message.slice(10, -1));
                handleSlayEnemy(data);
            } else if (message.startsWith('errorFixed(')) {
                const data = JSON.parse(message.slice(11, -1));
                handleErrorFixed(data);
            } else if (message.startsWith('perfectSave(')) {
                handlePerfectSave();
            }
        });
        
        // 移除本地快捷键监听，使用全局快捷键处理
        // 这样可以确保在代码编辑器中按Ctrl+S时也能触发击杀
        
        updateUI();
    </script>
</body>
</html>`;
    }
}