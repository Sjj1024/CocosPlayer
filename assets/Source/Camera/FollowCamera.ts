// Learn TypeScript:
//  - https://docs.cocos.com/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/manual/en/scripting/life-cycle-callbacks.html

import * as cc from 'cc';
import { getForward } from '../Utils/Node';
import { constantSpeedInterop, interopTo, interopToVec3 } from '../Utils/Math/Interop';

@cc._decorator.ccclass('FollowCamera')
@cc._decorator.executionOrder(9999)
export class FollowCamera extends cc.Component {
    @cc._decorator.property({
        displayName: 'Min Distance',
        tooltip: 'Min distance from camera to the target.',
    })
    public minDistance = 0.1;

    @cc._decorator.property({
        displayName: 'Max Distance',
        tooltip: 'Max distance from camera to the target.',
    })
    public maxDistance = 20.0;

    @cc._decorator.property({
        displayName: 'Init Distance',
        tooltip: 'Initial distance from camera to the target.',
    })
    public initialDistance = 1.0;

    @cc._decorator.property({
        displayName: 'Init Hori Rotation',
        tooltip: 'Initial horizontal rotation.',
    })
    public initialHorizonRotation = 0.0;

    @cc._decorator.property({
        displayName: 'Init Vert Rotation',
        tooltip: 'Initial vertical rotation.',
    })
    public initialVerticalRotation = 45.0;

    @cc._decorator.property({
        type: cc.Node,
        displayName: 'target',
        tooltip: 'The target that given camera follows.',
    })
    public target!: cc.Node;

    @cc._decorator.property({
        displayName: 'Auto Track',
        tooltip: 'Camera automatically follows the target. When turned on, camera automatically adjust to the back of target.',
    })
    public autoTraceEnabled = true;

    @cc._decorator.property({
        displayName: 'Auto Track Speed',
        tooltip: 'Camera move speed when automatically follows the target.',
        visible(this: FollowCamera) {
            return this.autoTraceEnabled;
        },
    })
    public autoTraceSpeed = 180.0;

    public start () {
        cc.Vec3.copy(this._lookAtPosition, this.target.position);

        this._desiredDistance = this.initialDistance;
        this._distance = this._desiredDistance;

        this._rotateHorizontal(this.initialHorizonRotation);
        this._rotateVertical(this.initialVerticalRotation);
        this._updatePosition();
    }

    public update (deltaTime: number) {
        this._distance = constantSpeedInterop(this._distance, this._desiredDistance, deltaTime, 5);
        this._zoom(this._distance);

        interopToVec3(this._lookAtPosition, this._lookAtPosition, this.target.worldPosition, deltaTime, 6);

        this._updatePosition();
    }

    public rotateHorizontal(angleDeg: number) {
        this._rotateHorizontal(angleDeg);
    }

    public rotateVertical(angleDeg: number) {
        this._rotateVertical(angleDeg);
    }

    public zoom(signedDistance: number) {
        this._zoomDelta(signedDistance);
    }

    private _lookAtPosition = new cc.Vec3();

    private _distance = 0.0;
    private _desiredDistance = 0.0;

    private _currentDir = cc.math.Vec3.negate(new cc.math.Vec3(), cc.math.Vec3.UNIT_Z);

    private _calcTransform (targetPosition: cc.math.Vec3, outPosition: cc.math.Vec3, outRotation: cc.math.Quat) {
        const dir = cc.math.Vec3.normalize(new cc.math.Vec3(), this._currentDir);
        cc.math.Quat.fromViewUp(outRotation, dir, cc.math.Vec3.UNIT_Y);
        cc.math.Vec3.add(outPosition, targetPosition, this._currentDir);
    }

    private _updatePosition () {
        const position = new cc.math.Vec3();
        const rotation = new cc.math.Quat();
        this._calcTransform(this._lookAtPosition, position, rotation);
        this.node.position = position;
        this.node.rotation = rotation;
    }

    private _zoom (distance: number) {
        cc.math.Vec3.normalize(this._currentDir, this._currentDir);
        cc.math.Vec3.multiplyScalar(this._currentDir, this._currentDir, distance);
    }

    private _zoomDelta (delta: number) {
        this._desiredDistance = cc.clamp(this._distance + delta, this.minDistance, this.maxDistance);
    }

    private _rotateHorizontal (angle: number) {
        const q = cc.math.Quat.fromAxisAngle(new cc.math.Quat(), cc.math.Vec3.UNIT_Y, cc.math.toRadian(angle));
        cc.math.Vec3.transformQuat(this._currentDir, this._currentDir, q);
    }

    private _rotateVertical (angle: number) {
        const currentDirNorm = cc.math.Vec3.normalize(new cc.math.Vec3(), this._currentDir);
        const up = cc.math.Vec3.UNIT_Y;

        const axis = cc.math.Vec3.cross(new cc.math.Vec3(), currentDirNorm, up);
        cc.math.Vec3.normalize(axis, axis);

        const currentAngle = cc.math.toDegree(cc.math.Vec3.angle(currentDirNorm, up));
        const DISABLE_FLIP_DELTA = 1e-2;
        const clampedAngle = currentAngle - cc.math.clamp(currentAngle - angle, 10.0 + DISABLE_FLIP_DELTA, 120.0 - DISABLE_FLIP_DELTA);
        const q = cc.math.Quat.fromAxisAngle(new cc.math.Quat(), axis, cc.math.toRadian(clampedAngle));
        cc.math.Vec3.transformQuat(this._currentDir, this._currentDir, q);
    }
}
