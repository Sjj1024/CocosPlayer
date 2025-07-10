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

    // 手动控制还是自动移动？
    @property
    public manualControl = true

    // 自旋转速度，单位°/s
    @_decorator.property({ unit: '°/s' })
    public spinSpeed = 1020

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
        console.log('onEnable--->')
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
        if (this.manualControl) {
            this._applyInput(deltaTime)
            // 执行角色控制器移动
            this._characterController.move(this._movement)
            // 调试模式下绘制移动方向
            drawLineOriginDirLen(
                this.node.worldPosition,
                Vec3.normalize(new Vec3(), this._movement),
                10,
                Color.RED
            )
        } else {
            // 处理随机移动和陀螺旋转
            this._updateRandomMovement(deltaTime)
            // 应用自旋转
            // this._applySpin(deltaTime)
        }

        // 处理正常的移动输入（当随机移动结束后）
        if (!this._isRandomMoving) {
            this._applyLocomotionInput(deltaTime)
        }

        // 更新反弹状态
        this._updateBounce(deltaTime)
        // console.log('this._bounceTimer', this._bounceTimer)
        // console.log('this._bounceCooldown', this._bounceCooldown)
    }

    // 应用自旋转
    private _applySpin(deltaTime: number) {
        // 计算自旋转角度
        const rotationAmount = 30
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
    // 是否自旋转
    private _isSpinning = false
    // 是否淡化视角
    private _shouldFadeView = true

    // 随机移动相关属性
    private _isRandomMoving = false
    // 随机移动方向
    private _randomMoveDirection = new Vec3()
    // 随机移动计时器，单位秒
    private _randomMoveTimer = 0
    // 随机移动持续时间，单位秒
    private _randomMoveDuration = 8000
    // 自旋转方向，1为顺时针，-1为逆时针
    private _spinDirection = 1

    // 反弹相关属性
    // 反弹系数 (0-1)，1表示完全弹性碰撞，0表示完全非弹性碰撞
    @_decorator.property({ range: [0, 1, 0.1] })
    public bounceCoefficient = 0.8

    // 添加反弹最小速度阈值
    @_decorator.property({ tooltip: '反弹后最小速度阈值，避免过小的移动' })
    public minBounceSpeed = 0.5

    // 是否启用反弹
    @_decorator.property
    public enableBounce = true

    // 当前移动速度向量
    private _currentVelocity = new Vec3()
    // 是否正在反弹
    private _isBouncing = false
    // 反弹计时器，防止连续反弹
    private _bounceTimer = 0
    // 反弹冷却时间，单位秒
    private _bounceCooldown = 0.001

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

    // 将输入向量转换到世界空间
    private _transformInputVector(inputVector: Readonly<Vec3>) {
        // 获取视角方向并去除垂直分量
        const viewDir = this._getViewDirection(new Vec3())
        viewDir.y = 0.0
        Vec3.normalize(viewDir, viewDir)

        // 创建从Z轴到视角方向的旋转四元数
        const q = Quat.rotationTo(new Quat(), Vec3.UNIT_Z, viewDir)
        // 将输入向量应用该旋转
        Vec3.transformQuat(inputVector, inputVector, q)
    }

    // 处理移动输入
    private _applyInput(deltaTime: number) {
        // 获取前后和左右移动的输入值
        const forwardInput = globalInputManager.getAxisValue(
            PredefinedAxisId.MoveForward
        )
        const rightInput = globalInputManager.getAxisValue(
            PredefinedAxisId.MoveRight
        )
        const inputVector = new Vec3(-rightInput, 0.0, forwardInput)

        // 没有输入时直接返回
        if (Vec3.equals(inputVector, Vec3.ZERO)) {
            return
        }

        this._hasMovementInput = true

        // 标准化输入向量并转换到世界空间
        Vec3.normalize(inputVector, inputVector)
        this._transformInputVector(inputVector)

        // 根据速度和帧时间计算移动向量
        Vec3.multiplyScalar(
            this._movement,
            inputVector,
            this.moveSpeed * deltaTime
        )
    }

    private _onPhysicalCharacterControllerHit(
        contact: physics.CharacterControllerContact
    ) {
        console.log('发生碰撞--->')
        // 处理碰撞逻辑
        if (!this.enableBounce || this._isBouncing) {
            return
        }

        // 检查是否是墙壁碰撞（法线向上分量小于0.7认为是墙壁）
        const hitNormal = contact.worldNormal
        if (Math.abs(hitNormal.y) > 0.7) {
            return // 跳过地面碰撞
        }

        // 计算反弹
        this._handleBounce(hitNormal)
    }

    // 初始化随机移动（添加方向有效性检查）
    private _initializeRandomMovement() {
        // 生成随机角度 (0-360度)
        const randomAngle = Math.random() * 360
        const randomRadian = toRadian(randomAngle)

        // 设置随机移动方向并确保归一化
        this._randomMoveDirection = new Vec3(
            Math.sin(randomRadian),
            0,
            Math.cos(randomRadian)
        )
        // 确保随机移动方向归一化
        Vec3.normalize(this._randomMoveDirection, this._randomMoveDirection)

        // 启用随机移动
        this._isRandomMoving = true
        // 重置随机移动计时器
        this._randomMoveTimer = 0
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

        // 检查移动方向是否为零向量
        if (Vec3.equals(this._randomMoveDirection, Vec3.ZERO)) {
            console.warn('移动方向为零向量，重新初始化随机移动')
            this._initializeRandomMovement()
        }

        // 更新随机移动计时器
        this._randomMoveTimer += deltaTime

        // 计算移动向量（考虑deltaTime）
        const movement = new Vec3()
        Vec3.multiplyScalar(movement, this._randomMoveDirection, this.moveSpeed)

        // 应用重力
        this._velocityY += -this.gravity * deltaTime
        movement.y += this._velocityY * deltaTime

        if (ATTACH_EXTRA_DOWNWARD_MOVEMENT_IF_NOT_IN_AIR && !this._falling) {
            movement.y -= EXTRA_DOWNWARD_MOVEMENT_DISTANCE_IF_NOT_IN_AIR
        }
        movement.y = 0

        // 移动角色
        // console.log('movement--->', movement)
        this._characterController.move(movement)

        // 绘制移动方向
        // console.log('绘制移动方向--->')
        drawLineOriginDirLen(
            this.node.worldPosition,
            Vec3.normalize(new Vec3(), movement),
            100,
            Color.RED
        )

        // 更新地面状态
        const grounded = this._characterController.isGrounded
        if (grounded) {
            this._velocityY = 0.0
            this._falling = false
        } else {
            this._falling = true
        }
    }

    // 处理反弹逻辑
    private _handleBounce(hitNormal: Vec3) {
        // 设置反弹状态
        this._isBouncing = true
        this._bounceTimer = 0

        // 计算当前移动方向
        Vec3.copy(this._currentVelocity, this._randomMoveDirection)
        Vec3.multiplyScalar(
            this._currentVelocity,
            this._currentVelocity,
            this.moveSpeed
        )

        console.log('碰撞前的移动方向', this._currentVelocity)

        // 计算点积并确保不会出现NaN
        const dotProduct = Vec3.dot(this._currentVelocity, hitNormal)
        if (isNaN(dotProduct)) {
            console.error('计算点积时出现NaN，使用随机方向替代')
            this._initializeRandomMovement()
            return
        }

        // 计算反射方向：v' = v - 2(v·n)n
        const reflection = new Vec3()
        Vec3.multiplyScalar(reflection, hitNormal, 2 * dotProduct)
        Vec3.subtract(reflection, this._currentVelocity, reflection)

        // 应用反弹系数
        Vec3.multiplyScalar(reflection, reflection, this.bounceCoefficient)

        // 检查反射向量是否有效
        const reflectionLength = Vec3.len(reflection)
        if (reflectionLength < this.minBounceSpeed) {
            // 如果反弹后速度太小，重新生成随机方向
            console.warn('反弹后速度太小，重新生成随机方向')
            this._initializeRandomMovement()
            return
        }

        // 更新随机移动方向（保持归一化）
        Vec3.normalize(this._randomMoveDirection, reflection)
        console.log('反弹后的移动方向', this._randomMoveDirection)
    }

    // 更新反弹状态
    private _updateBounce(deltaTime: number) {
        if (!this._isBouncing) {
            return
        }
        // 更新反弹计时器，单位秒，如果大于反弹冷却时间，则停止反弹
        this._bounceTimer += deltaTime
        // 如果反弹计时器大于反弹冷却时间，则停止反弹
        // console.log('this._bounceTimer', this._bounceTimer)
        // console.log('this._bounceCooldown', this._bounceCooldown)
        if (this._bounceTimer >= this._bounceCooldown) {
            this._isBouncing = false
        }
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
