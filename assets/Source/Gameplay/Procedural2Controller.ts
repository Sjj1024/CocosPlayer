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

    @_decorator.property({ unit: '°/s' })
    public moveTurnSpeed = 270

    @_decorator.property({ unit: 'm/s' })
    public moveSpeed = 6

    @_decorator.property({ unit: 'm/s²' })
    public gravity = 9.18

    @_decorator.property({ unit: 's' })
    public jumpPreparationDuration = 0.0

    private _cacheVelocity = new Vec3()
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

    start() {}

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
        if (globalInputManager.getAction(PredefinedActionId.ControlMode)) {
            this._shouldFadeView = !this._shouldFadeView
        }

        this._updateJumpPreparation(deltaTime)
        this._applyLocomotionInput(deltaTime)

        if (DEBUG && this.debug && globalShowTraces) {
            drawLineOriginDirLen(
                this.node.worldPosition,
                this._walkableNormal,
                1,
                Color.BLUE
            )
        }
    }

    private _applyLocomotionInput(deltaTime: number) {
        const { _movement } = this

        Vec3.zero(_movement)
        this._hasMovementInput = false

        if (this._canMove) {
            this._applyInput(deltaTime)
            if (!Vec3.equals(_movement, Vec3.ZERO)) {
                if (!this._falling) {
                    this._updateWalkableNormal()
                    this._applySliding(_movement)
                }
            }
        }

        this._applyJumpInput(deltaTime)

        if (DEBUG && this.debug && globalShowTraces) {
            drawLineOriginDirLen(
                this.node.worldPosition,
                Vec3.normalize(new Vec3(), _movement),
                1,
                Color.RED
            )
        }

        this._velocityY += -this.gravity * deltaTime
        _movement.y += this._velocityY * deltaTime
        // TODO: aim of the extra movement is intend to prevent jitter due to precision problem.
        if (ATTACH_EXTRA_DOWNWARD_MOVEMENT_IF_NOT_IN_AIR && !this._falling) {
            _movement.y -= EXTRA_DOWNWARD_MOVEMENT_DISTANCE_IF_NOT_IN_AIR
        }

        this._characterController.move(_movement)

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

        this._faceView(deltaTime)

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

    private _hasMovementInput = false

    private _velocityY = 0.0

    private _movement = new Vec3()

    private _falling = false

    private _walkableNormal = new Vec3(Vec3.UNIT_Y)
    private _lastContact = new Vec3()

    private _isPreparingJump = false
    private _jumpPreparationTimer = 0.0
    private _shouldFadeView = true

    private get _canJump() {
        return !this._falling && !this._isPreparingJump
    }

    private get _canMove() {
        return !this._isPreparingJump
    }

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

    private _transformInputVector(inputVector: Readonly<Vec3>) {
        const viewDir = this._getViewDirection(new Vec3())
        viewDir.y = 0.0
        Vec3.normalize(viewDir, viewDir)

        const q = Quat.rotationTo(new Quat(), Vec3.UNIT_Z, viewDir)
        Vec3.transformQuat(inputVector, inputVector, q)
    }

    private _onPhysicalCharacterControllerHit(
        contact: physics.CharacterControllerContact
    ) {}

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

    private _applySliding(v: Vec3) {
        if (this._falling) {
            return
        }

        // Don't slide if we're slide upwards.
        if (Vec3.angle(this._walkableNormal, v) > Math.PI / 2) {
            return
        }

        Vec3.projectOnPlane(v, new Vec3(v), this._walkableNormal)
    }

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

    private _doJump() {
        this._falling = true
        this._velocityY = 5
    }
}

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
