import {
    _decorator,
    Component,
    Vec3,
    Quat,
    input,
    Input,
    EventKeyboard,
    KeyCode,
    Color,
    Collider,
    toRadian,
    ICollisionEvent,
    NodeSpace,
} from 'cc'
import { drawLineOriginDirLen } from '../Utils/Debug/DebugDraw'
const { ccclass, property } = _decorator

@ccclass('SimpleMovementController')
export class SimpleMovementController extends Component {
    @property
    public debug = false

    // 移动速度 (m/s)
    @property
    moveSpeed: number = 5

    // 旋转速度 (度/秒)
    @property
    rotateSpeed: number = 90

    // 跳跃高度
    @property
    jumpHeight: number = 2

    // 重力加速度
    @property
    gravity: number = 9.8

    // 手动控制
    @property
    manualControl: boolean = true

    // 是否自旋转
    private _isSpinning = false
    // 自旋转方向，1为顺时针，-1为逆时针
    private _spinDirection = 1

    // 当前垂直速度
    private _verticalVelocity: number = 0
    // 是否在地面
    private _isGrounded: boolean = true
    // 输入状态
    private _input = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
    }
    // 随机移动相关属性
    private _isRandomMoving = false
    // 随机移动方向
    private _randomMoveDirection = new Vec3()
    // 当前移动速度向量
    private _currentVelocity = new Vec3()
    // 是否正在反弹
    private _isBouncing = false
    // 反弹计时器，防止连续反弹
    private _bounceTimer = 0
    // 反弹冷却时间，单位秒
    private _bounceCooldown = 0.001
    // 随机移动计时器，单位秒
    private _randomMoveTimer = 0
    // 反弹相关属性
    // 反弹系数 (0-1)，1表示完全弹性碰撞，0表示完全非弹性碰撞
    @_decorator.property({ range: [0, 1, 0.1] })
    public bounceCoefficient = 0.8

    // 添加反弹最小速度阈值
    @_decorator.property({ tooltip: '反弹后最小速度阈值，避免过小的移动' })
    public minBounceSpeed = 0.5

    start() {
        // 设置键盘输入监听
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this)
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this)
        // 设置碰撞监听
        const colider = this.node.getComponent(Collider)
        if (colider) {
            console.log('colider found')
            colider.on('onCollisionEnter', this.onCollisionEnter, this)
        } else {
            console.log('colider not found')
        }
        // 手动还是自动
        if (this.manualControl) {
            console.log('手动控制')
        } else {
            this._initializeRandomMovement()
        }
    }

    onCollisionEnter(event: ICollisionEvent) {
        console.log('onCollisionEnter---->', event)
        // 检查是否是墙壁碰撞（法线向上分量小于0.7认为是墙壁）
        const contacts = event.contacts
        const worleNormal = new Vec3()

        if (contacts && contacts.length > 0) {
            // 获取第一个接触点的世界法线
            contacts[0].getWorldNormalOnA(worleNormal)
            console.log('worleNormal---->', worleNormal)
            // 检查是否是墙壁碰撞（法线向上分量小于0.7认为是墙壁）
            const isWall = Math.abs(worleNormal.y) < 0.7

            if (isWall) {
                console.log('墙壁碰撞，法线方向:', worleNormal)
                this._handleBounce(worleNormal)
            } else {
                console.log('非墙壁碰撞（可能是地面或天花板）')
            }
        } else {
            console.log('没有碰撞')
        }
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

    // 手动控制
    private _manualControl(deltaTime: number) {
        // 计算移动方向
        const moveDirection = new Vec3(0, 0, 0)

        // 前后移动 (基于当前朝向)
        if (this._input.forward) {
            const forward = this.node.forward.negative()
            moveDirection.add(forward)
        }
        if (this._input.backward) {
            const backward = this.node.forward
            moveDirection.add(backward)
        }

        // 左右移动 (基于当前朝向)
        if (this._input.left) {
            const left = this.node.right.negative()
            moveDirection.add(left)
        }
        if (this._input.right) {
            const right = this.node.right
            moveDirection.add(right)
        }

        // 标准化移动方向并应用速度
        if (!Vec3.equals(moveDirection, Vec3.ZERO)) {
            Vec3.normalize(moveDirection, moveDirection)
            moveDirection.multiplyScalar(this.moveSpeed * deltaTime)
        }

        // 更新位置
        const newPosition = this.node.getPosition()
        // 将移动方向和当前位置相加，得到新的位置newPosition
        Vec3.add(newPosition, newPosition, moveDirection)

        // 简单地面检测
        if (newPosition.y <= 0) {
            newPosition.y = 0
            this._verticalVelocity = 0
            this._isGrounded = true
        }

        if (this.debug) {
            // 调试模式下绘制移动方向
            drawLineOriginDirLen(
                this.node.worldPosition,
                Vec3.normalize(new Vec3(), moveDirection),
                10,
                Color.RED
            )
        }

        // 将节点位置更新到最新位置
        this.node.setPosition(newPosition)

        // 旋转控制 (Q/E键)
        if (this._input.left) {
            this.node.rotate(
                Quat.fromAxisAngle(
                    new Quat(),
                    Vec3.UP,
                    ((this.rotateSpeed * Math.PI) / 180) * deltaTime
                )
            )
        }
        if (this._input.right) {
            this.node.rotate(
                Quat.fromAxisAngle(
                    new Quat(),
                    Vec3.UP,
                    ((-this.rotateSpeed * Math.PI) / 180) * deltaTime
                )
            )
        }
    }

    // 开始自旋转
    private _startSpinning() {
        // 启用陀螺旋转
        this._isSpinning = true
        // 随机旋转方向
        this._spinDirection = Math.random() > 0.5 ? 1 : -1
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

    // 随机控制
    private _randomControl(deltaTime: number) {
        // 确保方向向量是归一化的
        Vec3.normalize(this._randomMoveDirection, this._randomMoveDirection)

        // 计算位移（不修改原方向向量）
        const displacement = new Vec3(this._randomMoveDirection)
        displacement.multiplyScalar(this.moveSpeed * deltaTime)

        // 更新世界坐标（避免父节点变换影响）
        const newPosition = this.node.getPosition()
        Vec3.add(newPosition, newPosition, displacement)
        this.node.setPosition(newPosition)

        if (this.debug) {
            // 调试模式下绘制移动方向
            drawLineOriginDirLen(
                this.node.getPosition(),
                Vec3.normalize(new Vec3(), displacement),
                10,
                Color.RED
            )
        }

        // // 计算位移（不修改原方向向量）
        // const newPosition = this.node.getPosition()
        // // 创建一个与随机方向向量相同的新向量（避免修改原方向向量导致原来的方向向量越来越小）
        // const displacement = new Vec3(this._randomMoveDirection)
        // // 将位移向量乘以速度和时间，得到位移量
        // displacement.multiplyScalar(this.moveSpeed * deltaTime)
        // Vec3.add(newPosition, newPosition, displacement)
        // console.log('newPosition---->', newPosition)
        // this.node.setPosition(newPosition)

        // 调试信息
        // console.log('Random Move Direction:', this._randomMoveDirection)
        // console.log('Displacement:', displacement)
        // console.log('New Position:', newPosition)
    }

    update(deltaTime: number) {
        if (this.manualControl) {
            this._manualControl(deltaTime)
        } else {
            // 应用自旋转
            this._applySpin(deltaTime)
            this._randomControl(deltaTime)
        }
    }

    onKeyDown(event: EventKeyboard) {
        switch (event.keyCode) {
            case KeyCode.KEY_W:
                this._input.forward = true
                break
            case KeyCode.KEY_S:
                this._input.backward = true
                break
            case KeyCode.KEY_A:
                this._input.left = true
                break
            case KeyCode.KEY_D:
                this._input.right = true
                break
            case KeyCode.SPACE:
                this._input.jump = true
                break
        }
    }

    onKeyUp(event: EventKeyboard) {
        switch (event.keyCode) {
            case KeyCode.KEY_W:
                this._input.forward = false
                break
            case KeyCode.KEY_S:
                this._input.backward = false
                break
            case KeyCode.KEY_A:
                this._input.left = false
                break
            case KeyCode.KEY_D:
                this._input.right = false
                break
            case KeyCode.SPACE:
                this._input.jump = false
                break
        }
    }
}
