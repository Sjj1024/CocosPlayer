import { EventTarget } from "cc";

export class Event<TCallback extends (...args: any[]) => any = () => void> {
    public subscribe(callback: TCallback, thisArg?: any) {
        this._eventTarget.on('', callback, thisArg);
    }

    public unsubscribe(callback: TCallback, thisArg?: any) {
        this._eventTarget.off('', callback, thisArg);
    }

    public invoke(...args: Parameters<TCallback>) {
        this._eventTarget.emit('', ...args);
    }

    private _eventTarget = new EventTarget();
}