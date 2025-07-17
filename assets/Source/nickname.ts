import { _decorator, Component, Node, Vec3 } from 'cc'
const { ccclass, property } = _decorator

@ccclass('nickname')
export class nickname extends Component {
    private parentNode: Node | null = null

    start() {
        this.parentNode = this.node.parent!
        console.log('parentNode---->', this.parentNode)
    }

    update(deltaTime: number) {
        if (this.parentNode) {
            const parentPosition = this.parentNode.getPosition()
            console.log('parentPosition---->', parentPosition)
            this.node.setPosition(
                new Vec3(parentPosition.x, parentPosition.z, 0)
            )
        }
    }
}
