import { _decorator, Component, EventMouse, EventTouch, Node, toDegree, Vec2 } from 'cc';
import { FollowCamera } from './FollowCamera';
import { useMouseInput } from '../Utils/Env';
const { ccclass, property } = _decorator;

@ccclass('FollowCameraInput')
export class FollowCameraInput extends Component {
    @property(FollowCamera)
    camera!: FollowCamera;

    @property({
        displayName: 'Hori Rotation Speed',
        tooltip: 'Rotation speed on horizontal axis.',
    })
    public horizontalRotationSpeed = 1.0;

    @property({
        displayName: 'Vert Rotation Speed',
        tooltip: 'Vertical speed on horizontal axis.',
    })
    public verticalRotationSpeed = 1.0;

    @property({
        displayName: 'Scroll Zoom Speed',
        tooltip: 'Zoom speed with the mouse scroll wheel.',
    })
    public mouseWheelSpeed = 1;

    @property({
        displayName: 'Touchpad Zoom Speed',
        tooltip: 'Zoom speed with a touch pad.',
    })
    public touchZoomSpeed = 0.01;

    start() {

    }

    protected onEnable(): void {
        this._interpretTouchAsMouse = useMouseInput();
        this.node.on(Node.EventType.MOUSE_DOWN, this._onMouseDown, this);
        this.node.on(Node.EventType.MOUSE_UP, this._onMouseUp, this);
        this.node.on(Node.EventType.MOUSE_WHEEL, this._onMouseWheel, this);
        this.node.on(Node.EventType.TOUCH_START, this._onTouchBegin, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this._onTouchEnd, this);
    }

    protected onDisable(): void {
        this.node.off(Node.EventType.MOUSE_DOWN, this._onMouseDown, this);
        this.node.off(Node.EventType.MOUSE_UP, this._onMouseUp, this);
        this.node.off(Node.EventType.MOUSE_WHEEL, this._onMouseWheel, this);
        this.node.off(Node.EventType.TOUCH_START, this._onTouchBegin, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this._onTouchEnd, this);
    }

    update(deltaTime: number) {
        
    }

    private _interpretTouchAsMouse = false;
    private _mouseButtonPressing = {
        left: false,
        right: false,
        middle: false,
    };

    private get _mouseOrTouchMoveEnabled() {
        return this._mouseButtonPressing.left;
    }

    private _onMouseDown (event: EventMouse) {
        switch (event.getButton()) {
            default: break;
            case EventMouse.BUTTON_LEFT: this._mouseButtonPressing.left = true; break;
            case EventMouse.BUTTON_RIGHT: this._mouseButtonPressing.right = true; break;
            case EventMouse.BUTTON_MIDDLE: this._mouseButtonPressing.middle = true; break;
        }
    }

    private _onMouseUp (event: EventMouse) {
        switch (event.getButton()) {
            default: break;
            case EventMouse.BUTTON_LEFT: this._mouseButtonPressing.left = false; break;
            case EventMouse.BUTTON_RIGHT: this._mouseButtonPressing.right = false; break;
            case EventMouse.BUTTON_MIDDLE: this._mouseButtonPressing.middle = false; break;
        }
    }

    private _onMouseWheel (event: EventMouse) {
        const deltaZoom = -this.mouseWheelSpeed * Math.sign(event.getScrollY());
        this.camera.zoom(deltaZoom);
    }

    private _previousTwoTouchDistance = 0.0;
    private _touches: Array<{
        id: number;
        location: Vec2;
    }> = [];

    private _onTouchBegin (eventTouch: EventTouch) {
        const touches = eventTouch.getTouches();
        for (const touch of touches) {
            if (this._touches.length < 2) {
                this._touches.push({
                    id: touch.getID(),
                    location: Vec2.clone(touch.getLocation()),
                });
            }
        }
    }

    private _onTouchMove (eventTouch: EventTouch) {
        const touches = eventTouch.getTouches();
        if (touches.length === 1) {
            this._handSingleTouchMove(eventTouch);
            return;
        }

        console.log(`Touches Move: ${this._touches.length}`);
        if (this._touches.length !== 2) {
            return;
        }

        if (touches.length !== 2) {
            return;
        }

        const newTouches = this._touches.map(({ id }) => touches.find((touch) => touch.getID() === id));
        if (newTouches.some((touch) => !touch)) {
            return;
        }

        const oldTouch0Location = this._touches[0].location;
        const oldTouch1Location = this._touches[1].location;
        const newTouch0Location = newTouches[0]!.getLocation();
        const newTouch1Location = newTouches[1]!.getLocation();

        const dir0 = Vec2.subtract(new Vec2(), newTouch0Location, oldTouch0Location);
        Vec2.normalize(dir0, dir0);
        const dir1 = Vec2.subtract(new Vec2(), newTouch1Location, oldTouch1Location);
        Vec2.normalize(dir1, dir1);

        const angle = toDegree(Vec2.angle(dir0, dir1));
        if (angle > 170.0) {
            // Zoom
            const previousDistance = Vec2.distance(
                oldTouch0Location,
                oldTouch1Location,
            );
            const thisDistance = Vec2.distance(
                newTouch0Location,
                newTouch1Location,
            );
            const dDistance = thisDistance - previousDistance;
            if (dDistance !== 0) {
                const deltaZoom = -this.touchZoomSpeed * dDistance;
                this.camera.zoom(deltaZoom);
            }
        } else if (angle < 10.0) {
            const delta = Vec2.subtract(new Vec2(), newTouch0Location, oldTouch0Location);
            const dx = delta.x;
            if (dx) {
                const angle = -dx * this.horizontalRotationSpeed;
                this.camera.rotateHorizontal(angle);
            }
            const dy = delta.y;
            if (dy) {
                const angle = -dy * this.verticalRotationSpeed;
                this.camera.rotateVertical(angle);
            }
        }

        Vec2.copy(oldTouch0Location, newTouch0Location);
        Vec2.copy(oldTouch1Location, newTouch1Location);
    }

    private _onTouchEnd (eventTouch: EventTouch) {
        this._touches = this._touches.filter((touch) =>
            eventTouch.getTouches().findIndex((removal) => removal.getID() === touch.id) < 0);
    }

    private _handSingleTouchMove(event: EventTouch) {
        if (this._interpretTouchAsMouse && !this._mouseOrTouchMoveEnabled) {
            return;
        }
        this._rotateHorizontalByTouchMove(event.getDeltaX(), event.getDeltaY());
    }

    private _rotateHorizontalByTouchMove(deltaX: number, deltaY: number) {
        const dx = deltaX;
        if (dx) {
            const angle = -dx * this.horizontalRotationSpeed;
            this.camera.rotateHorizontal(angle);
        }
        const dy = deltaY;
        if (dy) {
            const angle = -dy * this.verticalRotationSpeed;
            this.camera.rotateVertical(angle);
        }
    }
}


