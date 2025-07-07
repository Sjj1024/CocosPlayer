import { _decorator, Component, EventMouse, EventTouch, Node, toDegree, Vec2 } from 'cc';
import { FollowCamera } from './FollowCamera';
import { useMouseInput } from '../Utils/Env';
const { ccclass, property } = _decorator;

// 跟随相机输入控制组件 - 处理鼠标和触摸输入来控制FollowCamera
@ccclass('FollowCameraInput')
export class FollowCameraInput extends Component {
    // 绑定的FollowCamera组件
    @property(FollowCamera)
    camera!: FollowCamera;

    // 水平旋转速度
    @property({
        displayName: 'Hori Rotation Speed',
        tooltip: 'Rotation speed on horizontal axis.',
    })
    public horizontalRotationSpeed = 1.0;

    // 垂直旋转速度
    @property({
        displayName: 'Vert Rotation Speed',
        tooltip: 'Vertical speed on horizontal axis.',
    })
    public verticalRotationSpeed = 1.0;

    // 鼠标滚轮缩放速度
    @property({
        displayName: 'Scroll Zoom Speed',
        tooltip: 'Zoom speed with the mouse scroll wheel.',
    })
    public mouseWheelSpeed = 1;

    // 触摸板缩放速度
    @property({
        displayName: 'Touchpad Zoom Speed',
        tooltip: 'Zoom speed with a touch pad.',
    })
    public touchZoomSpeed = 0.01;

    start() {
        // 空实现
    }

    // 组件启用时注册输入事件监听
    protected onEnable(): void {
        this._interpretTouchAsMouse = useMouseInput();
        this.node.on(Node.EventType.MOUSE_DOWN, this._onMouseDown, this);
        this.node.on(Node.EventType.MOUSE_UP, this._onMouseUp, this);
        this.node.on(Node.EventType.MOUSE_WHEEL, this._onMouseWheel, this);
        this.node.on(Node.EventType.TOUCH_START, this._onTouchBegin, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this._onTouchEnd, this);
    }

    // 组件禁用时取消输入事件监听
    protected onDisable(): void {
        this.node.off(Node.EventType.MOUSE_DOWN, this._onMouseDown, this);
        this.node.off(Node.EventType.MOUSE_UP, this._onMouseUp, this);
        this.node.off(Node.EventType.MOUSE_WHEEL, this._onMouseWheel, this);
        this.node.off(Node.EventType.TOUCH_START, this._onTouchBegin, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this._onTouchEnd, this);
    }

    update(deltaTime: number) {
        // 空实现
    }

    // 私有成员变量
    private _interpretTouchAsMouse = false; // 是否将触摸输入解释为鼠标输入
    private _mouseButtonPressing = {
        left: false,   // 左键是否按下
        right: false,  // 右键是否按下
        middle: false, // 中键是否按下
    };

    // 是否启用鼠标/触摸移动控制
    private get _mouseOrTouchMoveEnabled() {
        return this._mouseButtonPressing.left;
    }

    // 鼠标按下事件处理
    private _onMouseDown(event: EventMouse) {
        switch (event.getButton()) {
            default: break;
            case EventMouse.BUTTON_LEFT: this._mouseButtonPressing.left = true; break;
            case EventMouse.BUTTON_RIGHT: this._mouseButtonPressing.right = true; break;
            case EventMouse.BUTTON_MIDDLE: this._mouseButtonPressing.middle = true; break;
        }
    }

    // 鼠标释放事件处理
    private _onMouseUp(event: EventMouse) {
        switch (event.getButton()) {
            default: break;
            case EventMouse.BUTTON_LEFT: this._mouseButtonPressing.left = false; break;
            case EventMouse.BUTTON_RIGHT: this._mouseButtonPressing.right = false; break;
            case EventMouse.BUTTON_MIDDLE: this._mouseButtonPressing.middle = false; break;
        }
    }

    // 鼠标滚轮事件处理(缩放控制)
    private _onMouseWheel(event: EventMouse) {
        const deltaZoom = -this.mouseWheelSpeed * Math.sign(event.getScrollY());
        this.camera.zoom(deltaZoom);
    }

    // 触摸相关变量
    private _previousTwoTouchDistance = 0.0; // 上一次两指触摸的距离
    private _touches: Array<{
        id: number;    // 触摸点ID
        location: Vec2; // 触摸点位置
    }> = []; // 当前触摸点数组(最多记录2个)

    // 触摸开始事件处理
    private _onTouchBegin(eventTouch: EventTouch) {
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

    // 触摸移动事件处理
    private _onTouchMove(eventTouch: EventTouch) {
        const touches = eventTouch.getTouches();
        
        // 单指触摸处理
        if (touches.length === 1) {
            this._handSingleTouchMove(eventTouch);
            return;
        }

        // 双指触摸处理
        if (this._touches.length !== 2 || touches.length !== 2) {
            return;
        }

        // 查找对应的触摸点
        const newTouches = this._touches.map(({ id }) => touches.find((touch) => touch.getID() === id));
        if (newTouches.some((touch) => !touch)) {
            return;
        }

        // 获取新旧触摸点位置
        const oldTouch0Location = this._touches[0].location;
        const oldTouch1Location = this._touches[1].location;
        const newTouch0Location = newTouches[0]!.getLocation();
        const newTouch1Location = newTouches[1]!.getLocation();

        // 计算移动方向
        const dir0 = Vec2.subtract(new Vec2(), newTouch0Location, oldTouch0Location);
        Vec2.normalize(dir0, dir0);
        const dir1 = Vec2.subtract(new Vec2(), newTouch1Location, oldTouch1Location);
        Vec2.normalize(dir1, dir1);

        // 计算两指移动方向夹角
        const angle = toDegree(Vec2.angle(dir0, dir1));
        
        // 根据夹角判断手势类型
        if (angle > 170.0) {
            // 缩放手势(两指同向移动)
            const previousDistance = Vec2.distance(oldTouch0Location, oldTouch1Location);
            const thisDistance = Vec2.distance(newTouch0Location, newTouch1Location);
            const dDistance = thisDistance - previousDistance;
            if (dDistance !== 0) {
                const deltaZoom = -this.touchZoomSpeed * dDistance;
                this.camera.zoom(deltaZoom);
            }
        } else if (angle < 10.0) {
            // 旋转手势(两指反向移动)
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

        // 更新触摸点位置
        Vec2.copy(oldTouch0Location, newTouch0Location);
        Vec2.copy(oldTouch1Location, newTouch1Location);
    }

    // 触摸结束事件处理
    private _onTouchEnd(eventTouch: EventTouch) {
        this._touches = this._touches.filter((touch) =>
            eventTouch.getTouches().findIndex((removal) => removal.getID() === touch.id) < 0);
    }

    // 处理单指触摸移动
    private _handSingleTouchMove(event: EventTouch) {
        if (this._interpretTouchAsMouse && !this._mouseOrTouchMoveEnabled) {
            return;
        }
        this._rotateHorizontalByTouchMove(event.getDeltaX(), event.getDeltaY());
    }

    // 根据触摸移动量旋转相机
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