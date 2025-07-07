import { Director, director, input as engineInput, Input as EngineInput, KeyCode } from "cc";
import { predefinedActions, predefinedAxes } from "./Predefined";

// 类型定义
export type AxisId = number; // 轴ID类型
export type ActionId = number; // 动作ID类型

// 输入管理器类 - 负责处理键盘输入并转换为游戏内的轴和动作输入
class InputManager {
    constructor() {
        // 初始化预定义的轴映射
        for (const [id, { mappings }] of Object.entries(predefinedAxes)) {
            this._addAxis(id as unknown as number, ...mappings);
        }

        // 初始化预定义的动作映射
        for (const [id, { mappings }] of Object.entries(predefinedActions)) {
            this._addAction(id as unknown as number, ...mappings);
        }
        
        // 初始化输入监听
        this._initialize();

        // 在每帧更新前调用update方法
        director.on(Director.EVENT_BEFORE_UPDATE, () => {
            this.update(0.0);
        });
    }

    // 获取指定轴的当前值(-1到1之间)
    public getAxisValue(axisId: AxisId) {
        return this._axes[axisId]?.axis.value ?? 0.0;
    }

    // 检查指定动作是否被触发
    public getAction(actionId: ActionId) {
        return this._actions[actionId]?.triggered ?? false;
    }

    // 更新输入状态
    public update(deltaTime: number) {
        // 重置所有动作的触发状态
        for (const [_, action] of Object.entries(this._actions)) {
            action.triggered = false;
            if (action.triggered2) {
                action.triggered = true;
                action.triggered2 = false;
            }
        }

        // 计算所有轴的当前值
        for (const [_, { axis, mappings }] of Object.entries(this._axes)) {
            let axisValue = 0.0;
            for (const mapping of mappings) {
                const pressed = this._pressedKeys.has(mapping.keyCode);
                if (pressed) {
                    axisValue += 1.0 * mapping.scale; // 根据比例系数累加轴值
                }
            }
            axis.value = axisValue;
        }
    }

    // 添加轴映射
    private _addAxis(axisId: AxisId, ...mappings: { keyCode: KeyCode, scale: number }[]) {
        const axisRecord = this._axes[axisId] = new AxisRecord();
        for (const { keyCode, scale } of mappings) {
            axisRecord.mappings.push(new AxisMapping(keyCode, scale));
        }
    }

    // 添加动作映射
    private _addAction(actionId: ActionId, ...mappings: { keyCode: KeyCode }[]) {
        const actionRecord = this._actions[actionId] = new ActionRecord();
        for (const { keyCode } of mappings) {
            actionRecord.mappings.push(new ActionMapping(keyCode));
        }
    }

    // 初始化输入监听
    private _initialize() {
        // 键盘按下事件
        engineInput.on(EngineInput.EventType.KEY_DOWN, (event) => {
            this._pressedKeys.add(event.keyCode);
            // 检查是否有动作被触发
            for (const [_, action] of Object.entries(this._actions)) {
                if (action.mappings.some((mapping) => mapping.keyCode === event.keyCode)) {
                    action.triggered2 = true; // 标记为待触发状态
                }
            }
        });
        
        // 键盘释放事件
        engineInput.on(EngineInput.EventType.KEY_UP, (event) => {
            this._pressedKeys.delete(event.keyCode);
        });
    }

    // 私有成员变量
    private _axes: Record<AxisId, AxisRecord> = {}; // 所有轴记录
    private _actions: Record<ActionId, ActionRecord> = {}; // 所有动作记录
    private _pressedKeys = new Set(); // 当前按下的键集合
}

// 轴输入类 - 表示一个输入轴
class Axis {
    public value = 0.0; // 当前轴值(-1到1之间)
}

// 轴映射类 - 表示键盘按键到轴的映射
class AxisMapping {
    constructor(keyCode: KeyCode, scale: number) {
        this.keyCode = keyCode;
        this.scale = scale; // 比例系数(通常为1或-1)
    }

    public keyCode: KeyCode; // 映射的键盘按键
    public scale: number; // 按键按下时对轴值的贡献比例
}

// 轴记录类 - 包含轴及其所有映射
class AxisRecord {
    public readonly axis = new Axis(); // 轴实例
    public readonly mappings: AxisMapping[] = []; // 该轴的所有按键映射
}

// 动作输入类 - 占位类(实际未使用)
class Action {
}

// 动作映射类 - 表示键盘按键到动作的映射
class ActionMapping {
    constructor(public keyCode: KeyCode) {
    }
}

// 动作记录类 - 包含动作及其所有映射
class ActionRecord {
    public readonly action = new Action(); // 动作实例
    public readonly mappings: ActionMapping[] = []; // 该动作的所有按键映射

    public triggered = false; // 当前帧是否触发
    public triggered2 = false; // 下一帧是否触发(用于确保不丢失快速按键)
}

// 全局输入管理器实例
export const globalInputManager = new InputManager();