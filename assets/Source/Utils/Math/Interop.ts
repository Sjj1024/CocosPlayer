import { EPSILON, Quat, Vec3, Vec4, clamp, clamp01, lerp } from "cc";

export function interopTo(from: number, to: number, deltaTime: number, speed: number): number {
    if (speed <= 0.0) {
        return to;
    }
    const diff = to - from;
    if ((diff ** 2) < 1e-8) {
        return to;
    }
    const delta = diff * clamp(deltaTime * speed, 0.0, 1.0);
    return from + delta;
}

export function interopToVec3(out: Vec3, from: Readonly<Vec3>, to: Readonly<Vec3>, deltaTime: number, speed: number) {
    out.x = interopTo(from.x, to.x, deltaTime, speed);
    out.y = interopTo(from.y, to.y, deltaTime, speed);
    out.z = interopTo(from.z, to.z, deltaTime, speed);
    return out;
}

export function interopToQuat(out: Quat, from: Readonly<Quat>, to: Readonly<Quat>, deltaTime: number, speed: number) {
    if (speed <= 0.0) {
        return Quat.copy(out, to);
    }
    if (rotationEqualQuat(from, to)) {
        return Quat.copy(out, to);
    }
    const t = clamp01(deltaTime * speed / Math.max(quatAngularDistance(from, to), 1e-6));
    return Quat.slerp(out, from, to, t);
}

function rotationEqualQuat(a: Readonly<Quat>, b: Readonly<Quat>, epsilon = EPSILON) {
    return Quat.equals(a, b, epsilon) || Vec4.equals(Vec4.ZERO, new Vec4(a.x + b.x, a.y + b.y, a.z + b.z, a.w + b.w), epsilon);
}

function quatAngularDistance(a: Readonly<Quat>, b: Readonly<Quat>) {
    const dot = Quat.dot(a, b);
    return Math.acos(2 * dot * dot - 1);
}

export function constantSpeedInterop(from: number, to: number, deltaTime: number, speed: number): number {
    if (speed <= 0.0) {
        return to;
    }
    const diff = to - from;
    if ((diff ** 2) < 1e-8) {
        return to;
    }
    const t = clamp01((deltaTime * speed) / Math.abs(diff));
    return lerp(from, to, t);
}