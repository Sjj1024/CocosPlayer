import { _decorator, CapsuleCharacterController, CharacterController, Color, Component, Node } from 'cc';
import { drawCapsule } from './Debug/DebugDraw';
const { ccclass, property } = _decorator;

@ccclass('CharacterControllerDebugRenderer')
export class CharacterControllerDebugRenderer extends Component {
    update(deltaTime: number) {
        const characterController = this.node.getComponent(CharacterController);
        if (characterController instanceof CapsuleCharacterController) {
            drawCapsule(
                this.node.worldPosition,
                characterController.center,
                characterController.radius,
                characterController.height,
            );
            drawCapsule(
                this.node.worldPosition,
                characterController.center,
                characterController.radius + characterController.skinWidth,
                characterController.height,
                Color.BLACK,
            );
        }
    }
}


