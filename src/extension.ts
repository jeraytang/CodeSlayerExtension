import * as vscode from 'vscode';
import { GamePanel } from './gamePanel';

let gamePanel: GamePanel | undefined;
let documentChangeListener: vscode.Disposable | undefined;
let activeEditorListener: vscode.Disposable | undefined;
let saveDocumentListener: vscode.Disposable | undefined;
let diagnosticListener: vscode.Disposable | undefined;
let gameActive = false;
let comboCount = 0;
let lastSlayTime = 0;
let codeCount = 0;
let currentEditor: vscode.TextEditor | undefined;

// 配置项
interface CodeSlayerConfig {
    monsterSpawnMode: 'onTyping' | 'onError' | 'hybrid';
    maxMonsters: number;
    errorDetectionDelay: number;
}

// 为每个编辑器维护独立的状态
interface EditorState {
    codeCount: number;
    enemyCount: number;
    hasBoss: boolean;
    bossHP: number;
    bossMaxHP: number;
    spawnProgress: number;
    errorCount: number;
    lastErrorCount: number;
    errorDetectionTimer: NodeJS.Timeout | undefined;
}

const editorStates = new Map<string, EditorState>();

// 错误类型对应的怪物类型
enum ErrorType {
    SyntaxError = 'syntax',    // 语法错误
    Warning = 'warning',       // 警告
    TypeError = 'type',        // 类型错误
    ESLint = 'eslint'          // ESLint 问题
}

const COMBO_TIMEOUT = 2000;
const BOSS_TRIGGER_LINES = 30;
const BOSS_HITS_TO_KILL = 5;
const MAX_SPAWN_PER_CHANGE = 10;

// 获取配置
function getConfig(): CodeSlayerConfig {
    const config = vscode.workspace.getConfiguration('codeSlayer');
    return {
        monsterSpawnMode: config.get('monsterSpawnMode', 'onTyping'),
        maxMonsters: config.get('maxMonsters', 30),
        errorDetectionDelay: config.get('errorDetectionDelay', 500)
    };
}

// 检测错误类型
function detectErrorType(diagnostic: vscode.Diagnostic): ErrorType {
    // 检查诊断的来源和严重程度
    if (diagnostic.source === 'eslint') {
        return ErrorType.ESLint;
    }
    
    switch (diagnostic.severity) {
        case vscode.DiagnosticSeverity.Error:
            // 语法错误
            return ErrorType.SyntaxError;
        case vscode.DiagnosticSeverity.Warning:
            // 警告
            return ErrorType.Warning;
        case vscode.DiagnosticSeverity.Information:
            // 信息
            return ErrorType.ESLint;
        case vscode.DiagnosticSeverity.Hint:
            // 提示
            return ErrorType.ESLint;
        default:
            return ErrorType.SyntaxError;
    }
}

// 处理错误检测
function handleDiagnosticsChange(change: vscode.DiagnosticChangeEvent) {
    if (!gameActive || !currentEditor) return;
    
    const config = getConfig();
    if (config.monsterSpawnMode === 'onTyping') return;
    
    const editorKey = currentEditor.document.uri.toString();
    const state = getEditorState(currentEditor);
    
    // 清除之前的定时器
    if (state.errorDetectionTimer) {
        clearTimeout(state.errorDetectionTimer);
    }
    
    // 设置新的定时器
    state.errorDetectionTimer = setTimeout(() => {
        const diagnostics = vscode.languages.getDiagnostics(currentEditor!.document.uri);
        const newErrorCount = diagnostics.length;
        
        // 只处理增量变化
        if (newErrorCount > state.lastErrorCount) {
            const errorIncrease = newErrorCount - state.lastErrorCount;
            const spawnCount = Math.min(errorIncrease, MAX_SPAWN_PER_CHANGE);
            
            // 检查是否超过最大怪物数量
            if (state.enemyCount + spawnCount <= config.maxMonsters) {
                state.enemyCount += spawnCount;
                state.spawnProgress += spawnCount;
                
                // 检查是否生成Boss
                let hasBoss = false;
                if (!state.hasBoss && state.spawnProgress >= BOSS_TRIGGER_LINES) {
                    state.hasBoss = true;
                    state.bossHP = BOSS_HITS_TO_KILL;
                    state.bossMaxHP = BOSS_HITS_TO_KILL;
                    state.spawnProgress -= BOSS_TRIGGER_LINES;
                    hasBoss = true;
                }
                
                if (gamePanel) {
                    gamePanel.updateGameState({
                        type: 'codeWritten',
                        codeCount: state.codeCount,
                        enemySpawned: spawnCount,
                        hasBoss: hasBoss,
                        bossHP: state.bossHP,
                        bossMaxHP: state.bossMaxHP
                    });
                }
                
                if (hasBoss) {
                    vscode.window.showInformationMessage('Bug appeared! Boss incoming!');
                } else if (spawnCount > 0) {
                    vscode.window.showInformationMessage(spawnCount + ' enemies appeared!');
                }
            }
        } else if (newErrorCount < state.lastErrorCount) {
                // Error fixed, trigger flash slash
                const errorDecrease = state.lastErrorCount - newErrorCount;
                if (gamePanel) {
                    gamePanel.updateGameState({
                        type: 'errorFixed',
                        errorFixed: errorDecrease
                    });
                }
                vscode.window.showInformationMessage('Flash Slash! Fixed ' + errorDecrease + ' errors!');
            }
        
        state.lastErrorCount = newErrorCount;
        state.errorCount = newErrorCount;
        editorStates.set(editorKey, state);
    }, config.errorDetectionDelay);
}

export function activate(context: vscode.ExtensionContext) {
    const startCommand = vscode.commands.registerCommand('codeSlayer.start', () => {
        if (gameActive) {
            vscode.window.showInformationMessage('游戏已经在运行中！');
            return;
        }
        startGame(context);
    });

    const stopCommand = vscode.commands.registerCommand('codeSlayer.stop', () => {
        stopGame();
    });

    const slayCommand = vscode.commands.registerCommand('codeSlayer.slay', () => {
        if (!gameActive || !gamePanel) { return; }
        slayEnemy();
    });

    const saveAndSlayCommand = vscode.commands.registerCommand('codeSlayer.saveAndSlay', async () => {
        // 先执行保存操作
        await vscode.commands.executeCommand('workbench.action.files.save');
        
        // 不再需要手动调用slayEnemy()，因为saveDocumentListener会自动处理
    });

    context.subscriptions.push(startCommand, stopCommand, slayCommand, saveAndSlayCommand);
}

function getEditorState(editor: vscode.TextEditor): EditorState {
    const editorKey = editor.document.uri.toString();
    let state = editorStates.get(editorKey);

    if (!state) {
        const initialLines = editor.document.lineCount;
        // 初始化时获取当前错误数量，但不计入增量
        const initialDiagnostics = vscode.languages.getDiagnostics(editor.document.uri);
        state = {
            codeCount: initialLines,
            enemyCount: 0,
            hasBoss: false,
            bossHP: 0,
            bossMaxHP: BOSS_HITS_TO_KILL,
            spawnProgress: 0,
            errorCount: initialDiagnostics.length,
            lastErrorCount: initialDiagnostics.length,
            errorDetectionTimer: undefined
        };
        editorStates.set(editorKey, state);
    }

    return state;
}

function startGame(context: vscode.ExtensionContext) {
    gameActive = true;
    comboCount = 0;
    codeCount = 0;
    lastSlayTime = 0;
    currentEditor = vscode.window.activeTextEditor;

    // 检查是否有活动编辑器
    if (!currentEditor) {
        vscode.window.showInformationMessage('请先打开一个代码文件开始游戏！');
        gameActive = false;
        return;
    }

    gamePanel = new GamePanel(context.extensionUri);
    
    // 设置上下文键，用于控制快捷键
    vscode.commands.executeCommand('setContext', 'codeSlayer.gameActive', true);
    
    gamePanel.onDidDispose(() => {
        gamePanel = undefined;
        stopGame();
    });

    // 监听活动编辑器变化
    activeEditorListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (!gameActive || !gamePanel || !editor) { return; }
        
        currentEditor = editor;
        const state = getEditorState(editor);

        // 获取当前编辑器状态
        codeCount = state.codeCount;
        
        // 更新游戏状态
        gamePanel.updateGameState({
            type: 'start',
            comboCount: 0,
            enemyCount: state.enemyCount,
            codeCount: state.codeCount,
            hasBoss: state.hasBoss,
            bossHP: state.bossHP,
            bossMaxHP: state.bossMaxHP
        });

        vscode.window.showInformationMessage('Code Slayer: 已切换文件，继续战斗！');
    });

    documentChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
        if (!gameActive || !gamePanel || !currentEditor) { return; }
        
        // 只处理当前活动编辑器的变化
        if (event.document.uri.toString() !== currentEditor.document.uri.toString()) {
            return;
        }
        
        const state = getEditorState(currentEditor);
        const addedLines = event.contentChanges.reduce((sum, change) => {
            const added = (change.text.match(/\n/g) || []).length;
            const removed = change.range.end.line - change.range.start.line;
            return sum + Math.max(0, added - removed);
        }, 0);

        const content = event.document.getText();
        codeCount = content.split('\n').length;
        state.codeCount = codeCount;

        let spawned = 0;
        if (addedLines > 0) {
            spawned = Math.min(MAX_SPAWN_PER_CHANGE, addedLines);
            state.enemyCount += spawned;
            state.spawnProgress += addedLines;
        }

        if (!state.hasBoss && state.spawnProgress >= BOSS_TRIGGER_LINES) {
            state.hasBoss = true;
            state.bossHP = BOSS_HITS_TO_KILL;
            state.bossMaxHP = BOSS_HITS_TO_KILL;
            state.spawnProgress -= BOSS_TRIGGER_LINES;
        }

        editorStates.set(currentEditor.document.uri.toString(), state);
        
        gamePanel.updateGameState({
            type: 'codeWritten',
            codeCount,
            enemySpawned: spawned,
            hasBoss: state.hasBoss,
            bossHP: state.bossHP,
            bossMaxHP: state.bossMaxHP
        });

        if (state.hasBoss && state.bossHP === BOSS_HITS_TO_KILL) {
            vscode.window.showInformationMessage('🐛 Bug出现！Boss来袭！');
        } else if (spawned > 0) {
            vscode.window.showInformationMessage(`⚔️ ${spawned}个敌人出现！`);
        }
    });

    saveDocumentListener = vscode.workspace.onDidSaveTextDocument((document) => {
        if (!gameActive || !currentEditor) { return; }
        if (document.uri.toString() !== currentEditor.document.uri.toString()) { return; }
        
        // Check for perfect save
        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        if (diagnostics.length === 0) {
            // Zero errors = Perfect Save, trigger CLEAR + slash effect only
            if (gamePanel) {
                gamePanel.updateGameState({
                    type: 'perfectSave'
                });
            }
        } else {
            // Has errors = normal slay
            slayEnemy();
        }
    });

    // 监听诊断变化
    diagnosticListener = vscode.languages.onDidChangeDiagnostics(handleDiagnosticsChange);

    // 初始化当前编辑器状态
    if (currentEditor) {
        getEditorState(currentEditor);
    }

    gamePanel.updateGameState({
        type: 'start',
        comboCount: 0,
        enemyCount: 0,
        codeCount: 0,
        hasBoss: false,
        bossHP: 0,
        bossMaxHP: BOSS_HITS_TO_KILL
    });

    vscode.window.showInformationMessage('Code Slayer: 游戏开始！写代码产生敌人，按Ctrl+S斩杀！');
}

function stopGame() {
    gameActive = false;
    // 重置上下文键
    vscode.commands.executeCommand('setContext', 'codeSlayer.gameActive', false);
    
    if (documentChangeListener) {
        documentChangeListener.dispose();
        documentChangeListener = undefined;
    }
    if (activeEditorListener) {
        activeEditorListener.dispose();
        activeEditorListener = undefined;
    }
    if (saveDocumentListener) {
        saveDocumentListener.dispose();
        saveDocumentListener = undefined;
    }
    if (diagnosticListener) {
        diagnosticListener.dispose();
        diagnosticListener = undefined;
    }
    
    // 清理所有定时器
    editorStates.forEach(state => {
        if (state.errorDetectionTimer) {
            clearTimeout(state.errorDetectionTimer);
        }
    });
    
    if (gamePanel) {
        const panel = gamePanel;
        gamePanel = undefined;
        panel.dispose();
    }
    comboCount = 0;
    codeCount = 0;
    currentEditor = undefined;
    editorStates.clear();
    vscode.window.showInformationMessage('Code Slayer: 游戏结束！');
}

function slayEnemy() {
    if (!gamePanel) { return; }
    
    if (!currentEditor) {
        currentEditor = vscode.window.activeTextEditor;
        if (!currentEditor) {
            vscode.window.showInformationMessage('请先打开一个代码文件！');
            return;
        }
    }

    const state = getEditorState(currentEditor);

    const now = Date.now();
    
    if (now - lastSlayTime > COMBO_TIMEOUT) {
        comboCount = 0;
    }
    
    let isBossKill = false;
    let enemyKilled = 1;

    if (state.hasBoss) {
        state.bossHP = Math.max(0, state.bossHP - 1);
        if (state.bossHP === 0) {
            state.hasBoss = false;
            isBossKill = true;
        }
    } else {
        // 检查是否有敌人可以击杀
        if (state.enemyCount <= 0) {
            vscode.window.showInformationMessage('没有敌人可以击杀！');
            return;
        }
        state.enemyCount -= 1;
    }

    comboCount++;
    lastSlayTime = now;

    state.codeCount = codeCount;
    editorStates.set(currentEditor.document.uri.toString(), state);
    
    gamePanel.updateGameState({
        type: 'slay',
        comboCount,
        enemyKilled,
        isBossKill,
        hasBoss: state.hasBoss,
        bossHP: state.bossHP,
        bossMaxHP: state.bossMaxHP
    });

    if (isBossKill) {
        vscode.window.showInformationMessage(`💀 Boss击杀！Combo x${comboCount}！`);
    } else if (state.hasBoss) {
        vscode.window.showInformationMessage(`🩸 Boss受击！剩余 ${state.bossHP}/${state.bossMaxHP}`);
    } else if (comboCount > 5) {
        vscode.window.showInformationMessage(`⚡ Combo x${comboCount}！`);
    } else {
        vscode.window.showInformationMessage(`⚔️ 击杀敌人 x${enemyKilled}！`);
    }
}

export function deactivate() {
    stopGame();
}