import { _decorator, Component, Node, Toggle } from 'cc';
import { Procedural2_Animation } from '../../Models/Characters/Procedural2-Animation';
import { CharacterControllerDebugRenderer } from '../Utils/CharacterControllerDebugRenderer';
import { globalShowTraces, setGlobalShowTraces } from '../Utils/ShowTraceSwitch';
const { ccclass, property } = _decorator;

// 这是一个用于控制Procedural2角色动画相关UI的组件
@ccclass('Procedural2-Procedural2_Animation_UI-UI')
export class Procedural2_Animation_UI extends Component {
    // 以下是各种UI Toggle控件的属性绑定
    @property(Toggle)
    ikEnabledToggle!: Toggle; // 是否启用IK(反向动力学)的Toggle

    @property(Toggle)
    fitPelvisToggle!: Toggle; // 是否适配骨盆的Toggle

    @property(Toggle)
    fitPositionToggle!: Toggle; // 是否适配位置的Toggle

    @property(Toggle)
    fitRotationToggle!: Toggle; // 是否适配旋转的Toggle

    @property(Toggle)
    showTracesToggle!: Toggle; // 是否显示轨迹的Toggle

    @property(Toggle)
    displayCCTColliderToggle!: Toggle; // 是否显示角色控制器碰撞体的Toggle

    // 组件启动时初始化各个Toggle的状态
    protected start(): void {
        this.toggleIKEnabled(this.ikEnabledToggle);
        this.toggleFitPelvis(this.fitPelvisToggle);
        this.toggleFitPosition(this.fitPositionToggle);
        this.toggleFitRotation(this.fitRotationToggle);
        this.toggleShowTraces(this.showTracesToggle);
        this.toggleDisplayCCTCollider(this.displayCCTColliderToggle);
    }

    // 切换IK启用状态
    toggleIKEnabled(toggle: Toggle) {
        this._toggleBoolean('ikEnabled', toggle);
    }

    // 切换骨盆适配状态
    toggleFitPelvis(toggle: Toggle) {
        this._toggleBoolean('fitPelvis', toggle);
    }

    // 切换位置适配状态
    toggleFitPosition(toggle: Toggle) {
        this._toggleBoolean('fitPosition', toggle);
    }

    // 切换旋转适配状态
    toggleFitRotation(toggle: Toggle) {
        this._toggleBoolean('fitRotation', toggle);
    }

    // 切换是否显示轨迹
    toggleShowTraces(toggle: Toggle) {
        setGlobalShowTraces(toggle.isChecked);
    }

    // 切换是否显示角色控制器碰撞体
    toggleDisplayCCTCollider(toggle: Toggle) {
        this._displayCCTCollider = toggle.isChecked;
        // 遍历场景中所有CharacterControllerDebugRenderer组件并设置其启用状态
        for (const renderer of this.node.scene.getComponentsInChildren(CharacterControllerDebugRenderer)) {
            renderer.enabled = toggle.isChecked;
        }
    }

    // 通用方法：切换布尔值属性
    private _toggleBoolean(
        name: 'fitPelvis' | 'fitPosition' | 'fitRotation' | 'ikEnabled', 
        toggle: Toggle
    ) {
        // 获取场景中的Procedural2_Animation组件
        const anim = this.node.scene.getComponentInChildren(Procedural2_Animation);
        if (anim) {
            // 根据Toggle状态设置对应的属性值
            anim[name] = toggle.isChecked;
        }
    }

    // 私有字段：是否显示角色控制器碰撞体
    private _displayCCTCollider = false;
}