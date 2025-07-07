import { _decorator, animation, Color, Component, geometry, Node, physics, Quat, Vec3 } from 'cc';
import { Procedural2Controller } from '../../Source/Gameplay/Procedural2Controller';
import { injectComponent } from '../../Source/Utils/Component';
import { DEBUG } from 'cc/env';
import { drawCube, drawLineOriginDirLen } from '../../Source/Utils/Debug/DebugDraw';
import { interopTo, interopToQuat, interopToVec3 } from '../../Source/Utils/Math/Interop';
import { globalShowTraces } from '../../Source/Utils/ShowTraceSwitch';
const { ccclass, property, requireComponent } = _decorator;

const SMOOTH_FIT: boolean = true;

@ccclass(`Procedural2_Animation.FootIkSetting`)
class FootIkSetting {
    @property(Node)
    fkBone: Node | null = null;

    @property(Node)
    ikBone: Node | null = null;

    @property(Node)
    deformBone: Node | null = null;

    @property(Node)
    bottomReferenceBone: Node | null = null;

    @property(Node)
    debugTargetBone: Node | null = null;

    distanceToBottom = 0.0;

    public calculateDistanceToBottom() {
        const { deformBone, bottomReferenceBone } = this;
        const distanceToBottom = deformBone && bottomReferenceBone
            ? deformBone.worldPosition.y - bottomReferenceBone.worldPosition.y
            : 0;
        this.distanceToBottom = distanceToBottom;
    }
}

@ccclass('Procedural2_Animation')
@requireComponent(animation.AnimationController)
@requireComponent(Procedural2Controller)
export class Procedural2_Animation extends Component {
    @property
    debug = false;

    @property({ min: 0, unit: 'm' })
    footIKTraceStartBias = 0.5;

    @property({ min: 0, unit: 'm' })
    footIKTrackDistanceBelowFoot = 0.45;

    @property
    leftFootIKSetting = new FootIkSetting();

    @property
    rightFootIKSetting = new FootIkSetting();

    ikEnabled = true;

    fitPelvis = true;

    fitPosition = true;

    fitRotation = true;

    start() {
        this.leftFootIKSetting.calculateDistanceToBottom();
        this.rightFootIKSetting.calculateDistanceToBottom();
    }

    protected onEnable(): void {
        this._controller.onJumped.subscribe(this._onJumped, this);
    }

    protected onDisable(): void {
        this._controller.onJumped.unsubscribe(this._onJumped, this);
    }

    update(deltaTime: number) {
        this._updateMovementState(deltaTime);
        this._updateAirState(deltaTime);
        this._updateFootIK(deltaTime);
    }

    protected lateUpdate(dt: number): void {
        if (DEBUG && this.debug && globalShowTraces) {
            for (const setting of [this.leftFootIKSetting, this.rightFootIKSetting]) {
                if (setting.debugTargetBone) {
                    drawCube(setting.debugTargetBone.worldPosition, 0.02, Color.CYAN);
                }
            }
        }
    }

    @injectComponent(animation.AnimationController)
    private _animationController!: animation.AnimationController;

    @injectComponent(Procedural2Controller)
    private _controller!: Procedural2Controller;

    private _pelvisOffset = new Vec3();
    private _leftFootOffset = new FootOffset();
    private _rightFootOffset = new FootOffset();

    private _inAirTimer = 0.0;

    private _velocityLR = 0.0;
    private _velocityFB = 0.0;

    private _isInAir = true;

    private _onJumped() {
        this._animationController.setValue('Jump', true);
    }

    private _updateMovementState(deltaTime: number) {
        const velocity = this._controller.velocity;
        const moveSpeed = Vec3.len(new Vec3(velocity.x, 0.0, velocity.z));

        const isMoving = moveSpeed > 1e-2;
        const hasMovementInput = this._controller.hasMovementInput;
        // Sometimes the physics may cause little movement.
        // To prevent jitter, if the speed is not so big,
        // we should move only if there's "input", that's in controlled by player.
        const hasEffectiveMovementInput = isMoving && hasMovementInput;
        const shouldMove = hasEffectiveMovementInput || moveSpeed > 1.5;

        this._animationController.setValue('ShouldMove', shouldMove);
        this._animationController.setValue('MoveSpeed', moveSpeed);
        const localVelocity = new Vec3();
        {
            const q = Quat.invert(new Quat(), this.node.worldRotation);
            Vec3.transformQuat(localVelocity, velocity, q);
        }
        this._velocityLR = interopTo(this._velocityLR, localVelocity.x, deltaTime, 6);
        this._velocityFB = interopTo(this._velocityFB, localVelocity.z, deltaTime, 6);
        this._animationController.setValue('VelocityLR', this._velocityLR);
        this._animationController.setValue('VelocityFB', this._velocityFB);
    }

    private _updateAirState(deltaTime: number) {
        const GRAVITY_PULL_TIME_THRESHOLD = 0.1;

        const velocityY = this._controller.velocity.y;
        let inAir = false;
        if (!this._isInAir) {
            // If we're on ground and controller says we're falling,
            // - if we have positive y velocity, that's the case we're jumping up, we're in air.
            // - if we have negative y velocity, that's the case we're falling,
            //   but to avoid suddenly change of falling state(for example sliding down) of controller,
            //   we give a cache time to judgement.
            inAir = this._controller.falling && (velocityY > 0 || velocityY < - this._controller.gravity * GRAVITY_PULL_TIME_THRESHOLD);
        } else {
            inAir = this._controller.falling;
        }
        
        this._isInAir = inAir;
        this._animationController.setValue('InAir', this._isInAir);
    }

    private _updateFootIK(deltaTime: number) {
        const leftFootOffset = this._calculateFootOffset(this.leftFootIKSetting, new FootOffset());
        const rightFootOffset = this._calculateFootOffset(this.rightFootIKSetting, new FootOffset());
        if (SMOOTH_FIT) {
            this._leftFootOffset.interopTo(leftFootOffset, deltaTime);
        } else {
            FootOffset.copy(this._leftFootOffset, leftFootOffset);
        }
        if (SMOOTH_FIT) {
            this._rightFootOffset.interopTo(rightFootOffset, deltaTime);
        } else {
            FootOffset.copy(this._rightFootOffset, rightFootOffset);
        }

        this._updatePelvisOffset(deltaTime, leftFootOffset.position, rightFootOffset.position);

        this._setVarVec3OrZero('LeftFootOffset', this._leftFootOffset.position, this.fitPosition);
        this._setVarQuatOrIdentity('LeftFootRotationOffset', this._leftFootOffset.rotation, this.fitRotation);
        this._setVarVec3OrZero('RightFootOffset', this._rightFootOffset.position, this.fitPosition);
        this._setVarQuatOrIdentity('RightFootRotationOffset', this._rightFootOffset.rotation, this.fitRotation);
        this._setVarVec3OrZero('PelvisPositionOffset', this._pelvisOffset, this.fitPelvis);
        this._animationController.setValue('IKEnabled', this.ikEnabled);
    }

    private _setVarVec3OrZero(varName: string, value: Readonly<Vec3>, set: boolean) {
        this._animationController.setValue_experimental(varName, set ? value : Vec3.ZERO);
    }

    private _setVarQuatOrIdentity(varName: string, value: Readonly<Quat>, set: boolean) {
        this._animationController.setValue_experimental(varName, set ? value : Quat.IDENTITY);
    }

    private _calculateFootOffset(setting: FootIkSetting, out: FootOffset): FootOffset {
        if (this._isInAir) {
            return out.identity();
        }

        const {
            fkBone, ikBone, distanceToBottom,
        } = setting;
        const { footIKTraceStartBias } = this;
        if (!fkBone || !ikBone) {
            return out.identity();
        }

        const footLocation = new Vec3(fkBone.worldPosition);
        footLocation.y = this.node.worldPosition.y;

        const traceStart = new Vec3(footLocation);
        Vec3.scaleAndAdd(traceStart, traceStart, new Vec3(0, 1, 0), footIKTraceStartBias);
        const traceDistance = this.footIKTraceStartBias + this.footIKTrackDistanceBelowFoot;
        const physicsSystem = physics.PhysicsSystem.instance;

        const MASK_APPROX_WALKABLE = 1 << 3;
        let mask = ~0;
        mask &= ~MASK_APPROX_WALKABLE;
        const hit = physicsSystem.raycastClosest(
            geometry.Ray.set(new geometry.Ray(), traceStart.x, traceStart.y, traceStart.z, 0, -1, 0),
            mask,
            traceDistance,
            undefined,
        );

        if (DEBUG && this.debug && globalShowTraces) {
            drawCube(fkBone.worldPosition, 0.02, Color.YELLOW);
            drawCube(traceStart, 0.02, Color.RED);
            if (hit) {
                drawCube(physicsSystem.raycastClosestResult.hitPoint, 0.02, Color.BLUE);
            }
            drawLineOriginDirLen(traceStart, new Vec3(0, -1, 0), traceDistance);
        }

        if (!hit) {
            return out.identity();
        }

        const { hitPoint, hitNormal } = physicsSystem.raycastClosestResult;

        const targetPosition = Vec3.copy(new Vec3(), hitPoint);
        // targetPosition.y += distanceToBottom;
        Vec3.scaleAndAdd(targetPosition, targetPosition, hitNormal, distanceToBottom);

        const footLocationLifted = new Vec3(footLocation);
        footLocationLifted.y += distanceToBottom;

        Vec3.subtract(out.position, targetPosition, footLocationLifted);
        Quat.rotationTo(out.rotation, Vec3.UNIT_Y, hitNormal);
        return out;
    }

    private _updatePelvisOffset(deltaTime: number, leftFootTargetOffset: Readonly<Vec3>, rightFootTargetOffset: Readonly<Vec3>) {
        const pelvisOffset = leftFootTargetOffset.y < rightFootTargetOffset.y ? leftFootTargetOffset : rightFootTargetOffset;
        if (SMOOTH_FIT) {
            interopToVec3(
                this._pelvisOffset, this._pelvisOffset, pelvisOffset, deltaTime, pelvisOffset.y > this._pelvisOffset.y ? 10 : 15);
        } else {
            Vec3.copy(this._pelvisOffset, pelvisOffset);
        }
    }
}

class FootOffset {
    constructor(
        public readonly position = new Vec3(),
        public readonly rotation = new Quat(),
    ) {
    }

    public identity() {
        Vec3.zero(this.position);
        Quat.identity(this.rotation);
        return this;
    }

    public static copy(target: FootOffset, source: FootOffset) {
        Vec3.copy(target.position, source.position);
        Quat.copy(target.rotation, source.rotation);
    }

    public interopTo(target: FootOffset, deltaTime: number) {
        interopToVec3(
            this.position, this.position, target.position, deltaTime, target.position.y > this.position.y ? 30 : 15,
        );
        interopToQuat(
            this.rotation, this.rotation, target.rotation, deltaTime, 30,
        );
    }
}
