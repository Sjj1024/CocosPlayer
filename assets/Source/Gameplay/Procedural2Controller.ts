import {
    _decorator,
    CharacterController,
    Color,
    Component,
    debug,
    find,
    geometry,
    Node,
    NodeSpace,
    physics,
    Quat,
    toDegree,
    toRadian,
    Vec3,
} from 'cc'
import { injectComponent } from '../Utils/Component'
import { globalInputManager } from '../Input/Input'
import { PredefinedActionId, PredefinedAxisId } from '../Input/Predefined'
import { getForward } from '../Utils/Node'
import { DEBUG } from 'cc/env'
import { drawLineOriginDirLen } from '../Utils/Debug/DebugDraw'
import { Event } from '../Utils/Event'
import { globalShowTraces } from '../Utils/ShowTraceSwitch'
const { ccclass, property } = _decorator

// 常量定义：是否在不空中状态下附加额外的向下移动
const ATTACH_EXTRA_DOWNWARD_MOVEMENT_IF_NOT_IN_AIR: boolean = true
// 常量定义：不空中状态下的额外向下移动距离
const EXTRA_DOWNWARD_MOVEMENT_DISTANCE_IF_NOT_IN_AIR = 0.1

@ccclass('Procedural2Controller')
export class Procedural2Controller extends Component {
    @property
    public debug = false // 是否开启调试模式

    @_decorator.property({ unit: '°/s' })
    public moveTurnSpeed = 270 // 移动转向速度(度/秒)

    @_decorator.property({ unit: 'm/s' })
    public moveSpeed = 6 // 移动速度(米/秒)

    @_decorator.property({ unit: 'm/s²' })
    public gravity = 9.18 // 重力加速度(米/秒²)

    @_decorator.property({ unit: 's' })
    public jumpPreparationDuration = 0.0 // 跳跃准备时间(秒)

    // 获取当前速度(包含垂直速度)
    private _cacheVelocity = new Vec3()
    get velocity() {
        return Vec3.set(
            this._cacheVelocity,
            this._characterController.velocity.x,
            this._velocityY,
            this._characterController.velocity.z
        )
    }

    // 是否处于下落状态
    get falling() {
        return this._falling
    }

    // 是否有移动输入
    get hasMovementInput() {
        return this._hasMovementInput
    }

    start() {}

    // 跳跃事件
    public onJumped = new Event()

    protected onEnable(): void {
        // 注册角色控制器碰撞事件
        this._characterController.on(
            'onControllerColliderHit',
            this._onPhysicalCharacterControllerHit,
            this
        )
    }

    protected onDisable(): void {
        // 取消注册角色控制器碰撞事件
        this._characterController.off(
            'onControllerColliderHit',
            this._onPhysicalCharacterControllerHit,
            this
        )
    }

    // 每帧更新
    update(deltaTime: number) {
        // 切换视角控制模式
        if (globalInputManager.getAction(PredefinedActionId.ControlMode)) {
            this._shouldFadeView = !this._shouldFadeView
        }

        // 更新跳跃准备状态
        this._updateJumpPreparation(deltaTime)
        // 应用移动输入
        this._applyLocomotionInput(deltaTime)

        // 调试模式下绘制可行走表面法线
        if (DEBUG && this.debug && globalShowTraces) {
            drawLineOriginDirLen(
                this.node.worldPosition,
                this._walkableNormal,
                1,
                Color.BLUE
            )
        }
    }

    // 应用移动逻辑
    private _applyLocomotionInput(deltaTime: number) {
        const { _movement } = this

        Vec3.zero(_movement)
        this._hasMovementInput = false

        // 如果可以移动，则处理输入
        if (this._canMove) {
            this._applyInput(deltaTime)
            if (!Vec3.equals(_movement, Vec3.ZERO)) {
                if (!this._falling) {
                    // 更新可行走表面法线并应用斜坡滑动
                    this._updateWalkableNormal()
                    this._applySliding(_movement)
                }
            }
        }

        // 处理跳跃输入
        this._applyJumpInput(deltaTime)

        // 调试模式下绘制移动方向
        if (DEBUG && this.debug && globalShowTraces) {
            drawLineOriginDirLen(
                this.node.worldPosition,
                Vec3.normalize(new Vec3(), _movement),
                1,
                Color.RED
            )
        }

        // 应用重力
        this._velocityY += -this.gravity * deltaTime
        _movement.y += this._velocityY * deltaTime

        // 如果不处于空中状态，附加额外的向下移动以防止抖动
        if (ATTACH_EXTRA_DOWNWARD_MOVEMENT_IF_NOT_IN_AIR && !this._falling) {
            _movement.y -= EXTRA_DOWNWARD_MOVEMENT_DISTANCE_IF_NOT_IN_AIR
        }

        // 移动角色控制器
        this._characterController.move(_movement)

        // 更新地面状态
        const grounded = this._characterController.isGrounded
        if (grounded) {
            this._velocityY = 0.0
            this._falling = false
        } else {
            this._falling = true
        }
    }

    // 处理移动输入
    private _applyInput(deltaTime: number) {
        // 获取前后和左右输入
        const forwardInput = globalInputManager.getAxisValue(
            PredefinedAxisId.MoveForward
        )
        const rightInput = globalInputManager.getAxisValue(
            PredefinedAxisId.MoveRight
        )
        const inputVector = new Vec3(-rightInput, 0.0, forwardInput)
        if (Vec3.equals(inputVector, Vec3.ZERO)) {
            return
        }

        this._hasMovementInput = true

        // 朝向视角方向
        this._faceView(deltaTime)

        // 标准化输入向量并转换到世界空间
        Vec3.normalize(inputVector, inputVector)
        this._transformInputVector(inputVector)

        // 计算最终移动向量
        Vec3.multiplyScalar(
            this._movement,
            inputVector,
            this.moveSpeed * deltaTime
        )
    }

    // 处理跳跃输入
    private _applyJumpInput(deltaTime: number) {
        if (!this._canJump) {
            return
        }
        if (globalInputManager.getAction(PredefinedActionId.Jump)) {
            // 开始跳跃准备
            this._jumpPreparationTimer = 0.0
            this._isPreparingJump = true
            this.onJumped.invoke()
        }
    }

    // 依赖注入的角色控制器组件
    @injectComponent(CharacterController)
    private _characterController!: CharacterController

    private _hasMovementInput = false // 是否有移动输入
    private _velocityY = 0.0 // 垂直方向速度
    private _movement = new Vec3() // 移动向量
    private _falling = false // 是否处于下落状态
    private _walkableNormal = new Vec3(Vec3.UNIT_Y) // 可行走表面法线
    private _lastContact = new Vec3() // 最后接触点

    // 跳跃相关状态
    private _isPreparingJump = false // 是否正在准备跳跃
    private _jumpPreparationTimer = 0.0 // 跳跃准备计时器
    private _shouldFadeView = true // 是否淡入视角

    // 是否可以跳跃
    private get _canJump() {
        return !this._falling && !this._isPreparingJump
    }

    // 是否可以移动
    private get _canMove() {
        return !this._isPreparingJump
    }

    // 获取视角方向
    private _getViewDirection(out: Vec3) {
        if (!this._shouldFadeView) {
            return Vec3.copy(out, getForward(this.node))
        }
        const mainCamera = find('Main Camera')
        if (!mainCamera) {
            return Vec3.set(out, 0, 0, -1)
        } else {
            return Vec3.negate(out, getForward(mainCamera))
        }
    }

    // 朝向视角方向
    private _faceView(deltaTime: number) {
        const viewDir = this._getViewDirection(new Vec3())
        viewDir.y = 0.0
        viewDir.normalize()

        const characterDir = getForward(this.node)
        characterDir.y = 0.0
        characterDir.normalize()

        // 计算当前朝向与视角方向的角度差
        const currentAimAngle = signedAngleVec3(
            characterDir,
            viewDir,
            Vec3.UNIT_Y
        )
        const currentAimAngleDegMag = toDegree(Math.abs(currentAimAngle))

        // 计算本帧最大旋转角度
        const maxRotDegMag = this.moveTurnSpeed * deltaTime
        const rotDegMag = Math.min(maxRotDegMag, currentAimAngleDegMag)
        // 执行旋转
        const q = Quat.fromAxisAngle(
            new Quat(),
            Vec3.UNIT_Y,
            Math.sign(currentAimAngle) * toRadian(rotDegMag)
        )
        this.node.rotate(q, NodeSpace.WORLD)
    }

    // 将输入向量转换到世界空间
    private _transformInputVector(inputVector: Readonly<Vec3>) {
        const viewDir = this._getViewDirection(new Vec3())
        viewDir.y = 0.0
        Vec3.normalize(viewDir, viewDir)

        // 计算从Z轴到视角方向的旋转，并应用到输入向量
        const q = Quat.rotationTo(new Quat(), Vec3.UNIT_Z, viewDir)
        Vec3.transformQuat(inputVector, inputVector, q)
    }

    // 角色控制器碰撞回调(当前为空实现)
    private _onPhysicalCharacterControllerHit(
        contact: physics.CharacterControllerContact
    ) {}

    // 更新可行走表面法线
    private _updateWalkableNormal() {
        Vec3.copy(this._walkableNormal, Vec3.UNIT_Y)
        const traceStart = new Vec3(this.node.worldPosition)
        const traceDistance = 1
        // 向下发射射线检测地面
        const ray = geometry.Ray.set(
            new geometry.Ray(),
            traceStart.x,
            traceStart.y,
            traceStart.z,
            0,
            -1,
            0
        )
        const physicsSystem = physics.PhysicsSystem.instance
        const hit = physicsSystem.raycastClosest(
            ray,
            undefined,
            traceDistance,
            false
        )
        if (!hit) {
            return
        }
        // 更新可行走表面法线
        Vec3.copy(
            this._walkableNormal,
            physicsSystem.raycastClosestResult.hitNormal
        )
    }

    // 应用斜坡滑动
    private _applySliding(v: Vec3) {
        if (this._falling) {
            return
        }

        // 如果移动方向与法线夹角大于90度(向上移动)，不应用滑动
        if (Vec3.angle(this._walkableNormal, v) > Math.PI / 2) {
            return
        }

        // 将移动向量投影到斜坡平面上
        Vec3.projectOnPlane(v, new Vec3(v), this._walkableNormal)
    }

    // 更新跳跃准备状态
    private _updateJumpPreparation(deltaTime: number) {
        if (!this._isPreparingJump) {
            return
        }
        this._jumpPreparationTimer += deltaTime
        // 跳跃准备时间结束后执行跳跃
        if (this._jumpPreparationTimer >= this.jumpPreparationDuration) {
            this._isPreparingJump = false
            this._doJump()
        }
    }

    // 执行跳跃
    private _doJump() {
        this._falling = true
        this._velocityY = 5 // 设置初始跳跃速度
    }
}

// 计算两个向量之间的有符号角度
function signedAngleVec3(
    a: Readonly<Vec3>,
    b: Readonly<Vec3>,
    normal: Readonly<Vec3>
) {
    const angle = Vec3.angle(a, b)
    const cross = Vec3.cross(new Vec3(), a, b)
    cross.normalize()
    return Vec3.dot(cross, normal) < 0 ? -angle : angle
}
