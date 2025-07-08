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

const ATTACH_EXTRA_DOWNWARD_MOVEMENT_IF_NOT_IN_AIR: boolean = true
const EXTRA_DOWNWARD_MOVEMENT_DISTANCE_IF_NOT_IN_AIR = 0.1

@ccclass('Procedural2Controller')
export class Procedural2Controller extends Component {
    @property
    public debug = false

    @property
    public enableSpin = true

    @property
    public enableRandomMovement = true

    // 自旋转速度，单位°/s
    @_decorator.property({ unit: '°/s' })
    public spinSpeed = 720

    // 移动转向速度，单位°/s
    @_decorator.property({ unit: '°/s' })
    public moveTurnSpeed = 270

    // 移动速度，单位m/s
    @_decorator.property({ unit: 'm/s' })
    public moveSpeed = 6

    // 重力加速度，单位m/s²
    @_decorator.property({ unit: 'm/s²' })
    public gravity = 9.18

    // 跳跃准备时间，单位秒
    @_decorator.property({ unit: 's' })
    public jumpPreparationDuration = 0.0

    // 缓存速度
    private _cacheVelocity = new Vec3()

    // 获取缓存速度
    get velocity() {
        return Vec3.set(
            this._cacheVelocity,
            this._characterController.velocity.x,
            this._velocityY,
            this._characterController.velocity.z
        )
    }

    get falling() {
        return this._falling
    }

    get hasMovementInput() {
        return this._hasMovementInput
    }

    start() {
        // 游戏开始时设置随机方向移动和陀螺旋转
        this._initializeRandomMovement()
        // 游戏开始时设置自旋转
        this._startSpinning()
    }

    public onJumped = new Event()

    protected onEnable(): void {
        this._characterController.on(
            'onControllerColliderHit',
            this._onPhysicalCharacterControllerHit,
            this
        )
    }

    protected onDisable(): void {
        this._characterController.off(
            'onControllerColliderHit',
            this._onPhysicalCharacterControllerHit,
            this
        )
    }

    update(deltaTime: number) {
        // 处理随机移动和陀螺旋转
        this._updateRandomMovement(deltaTime)
        this._applySpin(deltaTime)

        // 处理正常的移动输入（当随机移动结束后）
        if (!this._isRandomMoving) {
            this._applyLocomotionInput(deltaTime)
        }

        // 调试绘制
        if (DEBUG && this.debug && globalShowTraces) {
            drawLineOriginDirLen(
                this.node.worldPosition,
                this._walkableNormal,
                1,
                Color.BLUE
            )
        }
    }

    // 应用自旋转
    private _applySpin(deltaTime: number) {
        // 计算自旋转角度
        const rotationAmount = 1390 * deltaTime
        // 应用自旋转
        this.node.rotate(
            Quat.fromAxisAngle(
                new Quat(),
                Vec3.UNIT_Y,
                toRadian(rotationAmount)
            ),
            NodeSpace.WORLD
        )
    }

    private _applyLocomotionInput(deltaTime: number) {
        const { _movement } = this
        Vec3.zero(_movement)
        this._hasMovementInput = false

        // 处理移动输入（无论是否旋转都可以移动）
        if (this._canMove) {
            this._applyInput(deltaTime)
            if (!Vec3.equals(_movement, Vec3.ZERO)) {
                if (!this._falling) {
                    this._updateWalkableNormal()
                    this._applySliding(_movement)
                }
            }
        }

        // 处理跳跃
        this._applyJumpInput(deltaTime)

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

        if (ATTACH_EXTRA_DOWNWARD_MOVEMENT_IF_NOT_IN_AIR && !this._falling) {
            _movement.y -= EXTRA_DOWNWARD_MOVEMENT_DISTANCE_IF_NOT_IN_AIR
        }

        // 移动角色
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

    private _applyInput(deltaTime: number) {
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

        // 如果不旋转或者有移动输入时才朝向视角方向
        if (!this._isSpinning || !Vec3.equals(inputVector, Vec3.ZERO)) {
            this._faceView(deltaTime)
        }

        Vec3.normalize(inputVector, inputVector)
        this._transformInputVector(inputVector)

        Vec3.multiplyScalar(
            this._movement,
            inputVector,
            this.moveSpeed * deltaTime
        )
    }

    private _applyJumpInput(deltaTime: number) {
        if (!this._canJump) {
            return
        }
        if (globalInputManager.getAction(PredefinedActionId.Jump)) {
            this._jumpPreparationTimer = 0.0
            this._isPreparingJump = true
            this.onJumped.invoke()
        }
    }

    @injectComponent(CharacterController)
    private _characterController!: CharacterController

    // 是否移动输入
    private _hasMovementInput = false
    // 垂直速度
    private _velocityY = 0.0
    // 移动方向
    private _movement = new Vec3()
    // 是否在空中
    private _falling = false
    // 可行走表面法线
    private _walkableNormal = new Vec3(Vec3.UNIT_Y)
    // 上一次碰撞点
    private _lastContact = new Vec3()
    // 是否自旋转
    private _isSpinning = false

    // 是否准备跳跃
    private _isPreparingJump = false
    // 跳跃准备计时器，单位秒
    private _jumpPreparationTimer = 0.0
    // 是否淡化视角
    private _shouldFadeView = true

    // 随机移动相关属性
    private _isRandomMoving = false
    // 随机移动方向
    private _randomMoveDirection = new Vec3()
    // 随机移动计时器，单位秒
    private _randomMoveTimer = 0
    // 随机移动持续时间，单位秒
    private _randomMoveDuration = 80
    // 自旋转方向，1为顺时针，-1为逆时针
    private _spinDirection = 1

    private get _canJump() {
        return !this._falling && !this._isPreparingJump
    }

    private get _canMove() {
        return !this._isPreparingJump && !this._isRandomMoving
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

        const currentAimAngle = signedAngleVec3(
            characterDir,
            viewDir,
            Vec3.UNIT_Y
        )
        const currentAimAngleDegMag = toDegree(Math.abs(currentAimAngle))

        const maxRotDegMag = this.moveTurnSpeed * deltaTime
        const rotDegMag = Math.min(maxRotDegMag, currentAimAngleDegMag)
        const q = Quat.fromAxisAngle(
            new Quat(),
            Vec3.UNIT_Y,
            Math.sign(currentAimAngle) * toRadian(rotDegMag)
        )
        this.node.rotate(q, NodeSpace.WORLD)
    }

    // 转换输入向量
    private _transformInputVector(inputVector: Readonly<Vec3>) {
        const viewDir = this._getViewDirection(new Vec3())
        viewDir.y = 0.0
        Vec3.normalize(viewDir, viewDir)

        const q = Quat.rotationTo(new Quat(), Vec3.UNIT_Z, viewDir)
        Vec3.transformQuat(inputVector, inputVector, q)
    }

    private _onPhysicalCharacterControllerHit(
        contact: physics.CharacterControllerContact
    ) {
        // 处理碰撞逻辑
    }

    // 更新可行走表面法线
    private _updateWalkableNormal() {
        Vec3.copy(this._walkableNormal, Vec3.UNIT_Y)
        const traceStart = new Vec3(this.node.worldPosition)
        const traceDistance = 1
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
        Vec3.copy(
            this._walkableNormal,
            physicsSystem.raycastClosestResult.hitNormal
        )
    }

    // 应用滑动
    private _applySliding(v: Vec3) {
        if (this._falling) {
            return
        }

        if (Vec3.angle(this._walkableNormal, v) > Math.PI / 2) {
            return
        }

        Vec3.projectOnPlane(v, new Vec3(v), this._walkableNormal)
    }

    // 更新跳跃准备
    private _updateJumpPreparation(deltaTime: number) {
        if (!this._isPreparingJump) {
            return
        }
        this._jumpPreparationTimer += deltaTime
        if (this._jumpPreparationTimer >= this.jumpPreparationDuration) {
            this._isPreparingJump = false
            this._doJump()
        }
    }

    // 执行跳跃
    private _doJump() {
        this._falling = true
        this._velocityY = 5
    }

    // 初始化随机移动
    private _initializeRandomMovement() {
        // 生成随机角度 (0-360度)
        const randomAngle = Math.random() * 360
        const randomRadian = toRadian(randomAngle)

        // 设置随机移动方向
        this._randomMoveDirection = new Vec3(
            Math.sin(randomRadian),
            0,
            Math.cos(randomRadian)
        )

        // 启用随机移动
        this._isRandomMoving = true
        // 重置随机移动计时器
        this._randomMoveTimer = 0
        // 设置随机移动持续时间
        this._randomMoveDuration = 80
    }

    // 开始自旋转
    private _startSpinning() {
        // 启用陀螺旋转
        this._isSpinning = true
        // 随机旋转方向
        this._spinDirection = Math.random() > 0.5 ? 1 : -1
    }

    // 更新随机移动
    private _updateRandomMovement(deltaTime: number) {
        // 如果不在随机移动状态，则返回
        if (!this._isRandomMoving) {
            return
        }

        // 更新随机移动计时器
        this._randomMoveTimer += deltaTime

        // 检查是否应该停止随机移动
        if (this._randomMoveTimer >= this._randomMoveDuration) {
            this._stopRandomMovement()
            return
        }

        // 应用随机移动
        Vec3.zero(this._movement)

        // 使用随机方向进行移动
        Vec3.multiplyScalar(
            this._movement,
            this._randomMoveDirection,
            this.moveSpeed * deltaTime
        )

        // 应用重力
        this._velocityY += -this.gravity * deltaTime
        this._movement.y += this._velocityY * deltaTime

        if (ATTACH_EXTRA_DOWNWARD_MOVEMENT_IF_NOT_IN_AIR && !this._falling) {
            this._movement.y -= EXTRA_DOWNWARD_MOVEMENT_DISTANCE_IF_NOT_IN_AIR
        }

        // 移动角色
        this._characterController.move(this._movement)

        // 更新地面状态
        const grounded = this._characterController.isGrounded
        if (grounded) {
            this._velocityY = 0.0
            this._falling = false
        } else {
            this._falling = true
        }

        // 调试绘制随机移动方向
        if (DEBUG && this.debug && globalShowTraces) {
            drawLineOriginDirLen(
                this.node.worldPosition,
                Vec3.normalize(new Vec3(), this._movement),
                1,
                Color.GREEN
            )
        }
    }

    // 停止随机移动
    private _stopRandomMovement() {
        this._isRandomMoving = false
        this._isSpinning = false
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
