import { _decorator, Component, Node, Toggle } from 'cc';
import { Procedural2_Animation } from '../../Models/Characters/Procedural2-Animation';
import { CharacterControllerDebugRenderer } from '../Utils/CharacterControllerDebugRenderer';
import { globalShowTraces, setGlobalShowTraces } from '../Utils/ShowTraceSwitch';
const { ccclass, property } = _decorator;

@ccclass('Procedural2-Procedural2_Animation_UI-UI')
export class Procedural2_Animation_UI extends Component {
    @property(Toggle)
    ikEnabledToggle!: Toggle;

    @property(Toggle)
    fitPelvisToggle!: Toggle;

    @property(Toggle)
    fitPositionToggle!: Toggle;

    @property(Toggle)
    fitRotationToggle!: Toggle;

    @property(Toggle)
    showTracesToggle!: Toggle;

    @property(Toggle)
    displayCCTColliderToggle!: Toggle;

    protected start(): void {
        this.toggleIKEnabled(this.ikEnabledToggle);
        this.toggleFitPelvis(this.fitPelvisToggle);
        this.toggleFitPosition(this.fitPositionToggle);
        this.toggleFitRotation(this.fitRotationToggle);
        this.toggleShowTraces(this.showTracesToggle);
        this.toggleDisplayCCTCollider(this.displayCCTColliderToggle);
    }

    toggleIKEnabled(toggle: Toggle) {
        this._toggleBoolean('ikEnabled', toggle);
    }

    toggleFitPelvis(toggle: Toggle) {
        this._toggleBoolean('fitPelvis', toggle);
    }

    toggleFitPosition(toggle: Toggle) {
        this._toggleBoolean('fitPosition', toggle);
    }

    toggleFitRotation(toggle: Toggle) {
        this._toggleBoolean('fitRotation', toggle);
    }

    toggleShowTraces(toggle: Toggle) {
        setGlobalShowTraces(toggle.isChecked);
    }

    toggleDisplayCCTCollider(toggle: Toggle) {
        this._displayCCTCollider = toggle.isChecked;
        for (const renderer of this.node.scene.getComponentsInChildren(CharacterControllerDebugRenderer)) {
            renderer.enabled = toggle.isChecked;
        }
    }

    private _toggleBoolean(name: 'fitPelvis' | 'fitPosition' | 'fitRotation' | 'ikEnabled', toggle: Toggle) {
        const anim = this.node.scene.getComponentInChildren(Procedural2_Animation);
        if (anim) {
            anim[name] = toggle.isChecked;
        }
    }

    private _displayCCTCollider = false;
}


