// Learn TypeScript:
//  - https://docs.cocos.com/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/manual/en/scripting/life-cycle-callbacks.html

import * as cc from 'cc';
import { getForward } from '../Utils/Node';
import { constantSpeedInterop, interopTo, interopToVec3 } from '../Utils/Math/Interop';

// 跟随相机组件 - 实现第三人称相机跟随目标的功能
@cc._decorator.ccclass('FollowCamera')
@cc._decorator.executionOrder(9999) // 设置较晚的执行顺序确保在其他更新之后
export class FollowCamera extends cc.Component {
    // 相机与目标的最小距离
    @cc._decorator.property({
        displayName: 'Min Distance',
        tooltip: 'Min distance from camera to the target.',
    })
    public minDistance = 0.1;

    // 相机与目标的最大距离
    @cc._decorator.property({
        displayName: 'Max Distance',
        tooltip: 'Max distance from camera to the target.',
    })
    public maxDistance = 20.0;

    // 初始距离
    @cc._decorator.property({
        displayName: 'Init Distance',
        tooltip: 'Initial distance from camera to the target.',
    })
    public initialDistance = 1.0;

    // 初始水平旋转角度
    @cc._decorator.property({
        displayName: 'Init Hori Rotation',
        tooltip: 'Initial horizontal rotation.',
    })
    public initialHorizonRotation = 0.0;

    // 初始垂直旋转角度
    @cc._decorator.property({
        displayName: 'Init Vert Rotation',
        tooltip: 'Initial vertical rotation.',
    })
    public initialVerticalRotation = 45.0;

    // 跟随的目标节点
    @cc._decorator.property({
        type: cc.Node,
        displayName: 'target',
        tooltip: 'The target that given camera follows.',
    })
    public target!: cc.Node;

    // 是否启用自动追踪(使相机保持在目标后方)
    @cc._decorator.property({
        displayName: 'Auto Track',
        tooltip: 'Camera automatically follows the target. When turned on, camera automatically adjust to the back of target.',
    })
    public autoTraceEnabled = true;

    // 自动追踪速度(仅在启用自动追踪时显示)
    @cc._decorator.property({
        displayName: 'Auto Track Speed',
        tooltip: 'Camera move speed when automatically follows the target.',
        visible(this: FollowCamera) {
            return this.autoTraceEnabled;
        },
    })
    public autoTraceSpeed = 180.0;

    // 初始化相机位置和旋转
    public start () {
        // 初始化注视点为目标位置
        cc.Vec3.copy(this._lookAtPosition, this.target.position);

        // 设置初始距离
        this._desiredDistance = this.initialDistance;
        this._distance = this._desiredDistance;

        // 应用初始旋转
        this._rotateHorizontal(this.initialHorizonRotation);
        this._rotateVertical(this.initialVerticalRotation);
        
        // 更新相机位置
        this._updatePosition();
    }

    // 每帧更新相机位置
    public update (deltaTime: number) {
        // 平滑过渡到目标距离
        this._distance = constantSpeedInterop(this._distance, this._desiredDistance, deltaTime, 5);
        this._zoom(this._distance);

        // 平滑过渡到目标注视点
        interopToVec3(this._lookAtPosition, this._lookAtPosition, this.target.worldPosition, deltaTime, 6);

        // 更新相机位置
        this._updatePosition();
    }

    // 水平旋转相机(外部调用接口)
    public rotateHorizontal(angleDeg: number) {
        this._rotateHorizontal(angleDeg);
    }

    // 垂直旋转相机(外部调用接口)
    public rotateVertical(angleDeg: number) {
        this._rotateVertical(angleDeg);
    }

    // 缩放相机距离(外部调用接口)
    public zoom(signedDistance: number) {
        this._zoomDelta(signedDistance);
    }

    // 私有成员变量
    private _lookAtPosition = new cc.Vec3(); // 相机注视点位置
    private _distance = 0.0; // 当前相机距离
    private _desiredDistance = 0.0; // 目标相机距离
    private _currentDir = cc.math.Vec3.negate(new cc.math.Vec3(), cc.math.Vec3.UNIT_Z); // 当前相机方向

    // 计算相机变换(位置和旋转)
    private _calcTransform (targetPosition: cc.math.Vec3, outPosition: cc.math.Vec3, outRotation: cc.math.Quat) {
        // 计算相机方向并标准化
        const dir = cc.math.Vec3.normalize(new cc.math.Vec3(), this._currentDir);
        
        // 根据方向和上向量计算相机旋转
        cc.math.Quat.fromViewUp(outRotation, dir, cc.math.Vec3.UNIT_Y);
        
        // 计算相机位置(目标位置 + 方向向量 * 距离)
        cc.math.Vec3.add(outPosition, targetPosition, this._currentDir);
    }

    // 更新相机位置和旋转
    private _updatePosition () {
        const position = new cc.math.Vec3();
        const rotation = new cc.math.Quat();
        
        // 计算新的变换
        this._calcTransform(this._lookAtPosition, position, rotation);
        
        // 应用变换
        this.node.position = position;
        this.node.rotation = rotation;
    }

    // 设置相机距离
    private _zoom (distance: number) {
        // 标准化当前方向并乘以距离
        cc.math.Vec3.normalize(this._currentDir, this._currentDir);
        cc.math.Vec3.multiplyScalar(this._currentDir, this._currentDir, distance);
    }

    // 调整相机距离(带范围限制)
    private _zoomDelta (delta: number) {
        this._desiredDistance = cc.clamp(this._distance + delta, this.minDistance, this.maxDistance);
    }

    // 水平旋转相机(绕Y轴)
    private _rotateHorizontal (angle: number) {
        // 创建绕Y轴旋转的四元数
        const q = cc.math.Quat.fromAxisAngle(new cc.math.Quat(), cc.math.Vec3.UNIT_Y, cc.math.toRadian(angle));
        
        // 应用旋转到当前方向
        cc.math.Vec3.transformQuat(this._currentDir, this._currentDir, q);
    }

    // 垂直旋转相机(限制角度避免翻转)
    private _rotateVertical (angle: number) {
        // 标准化当前方向
        const currentDirNorm = cc.math.Vec3.normalize(new cc.math.Vec3(), this._currentDir);
        const up = cc.math.Vec3.UNIT_Y;

        // 计算旋转轴(当前方向与上向量的叉积)
        const axis = cc.math.Vec3.cross(new cc.math.Vec3(), currentDirNorm, up);
        cc.math.Vec3.normalize(axis, axis);

        // 计算当前与上向量的夹角
        const currentAngle = cc.math.toDegree(cc.math.Vec3.angle(currentDirNorm, up));
        
        // 限制旋转角度范围(10-120度之间)
        const DISABLE_FLIP_DELTA = 1e-2;
        const clampedAngle = currentAngle - cc.math.clamp(currentAngle - angle, 10.0 + DISABLE_FLIP_DELTA, 120.0 - DISABLE_FLIP_DELTA);
        
        // 创建旋转四元数并应用到当前方向
        const q = cc.math.Quat.fromAxisAngle(new cc.math.Quat(), axis, cc.math.toRadian(clampedAngle));
        cc.math.Vec3.transformQuat(this._currentDir, this._currentDir, q);
    }
}