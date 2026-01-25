/**
 * LinkedValue - A doubly-linked list node for chaining numeric values.
 *
 * @deprecated This class is unused and will be removed in a future version.
 * For snake/centipede chains, use arrays or implement chain logic directly.
 *
 * Useful for:
 * - Centipede/snake chains that need to split/merge
 * - Sequential entity movement with trail following
 * - Any ordered linked data structure
 */
export class LinkedValue {
    value: number;
    private _prev: LinkedValue | null;
    private _next: LinkedValue | null;

    constructor(value: number, prev: LinkedValue | null = null, next: LinkedValue | null = null) {
        this.value = value;
        this._prev = prev;
        this._next = next;

        // Fix up references if provided
        if (prev) prev._next = this;
        if (next) next._prev = this;
    }

    /** Get the first node in the chain */
    first(): LinkedValue {
        let node: LinkedValue = this; // eslint-disable-line @typescript-eslint/no-this-alias
        while (node._prev) {
            node = node._prev;
        }
        return node;
    }

    /** Get the last node in the chain */
    last(): LinkedValue {
        let node: LinkedValue = this; // eslint-disable-line @typescript-eslint/no-this-alias
        while (node._next) {
            node = node._next;
        }
        return node;
    }

    /** Get previous node, or null if this is the first */
    prev(): LinkedValue | null {
        return this._prev;
    }

    /** Get next node, or null if this is the last */
    next(): LinkedValue | null {
        return this._next;
    }

    /** Check if this is the head (first) of the chain */
    isHead(): boolean {
        return this._prev === null;
    }

    /** Check if this is the tail (last) of the chain */
    isTail(): boolean {
        return this._next === null;
    }

    /** Get the length of the chain from this node to the end */
    lengthToEnd(): number {
        let count = 1;
        let node: LinkedValue | null = this; // eslint-disable-line @typescript-eslint/no-this-alias
        while (node._next) {
            count++;
            node = node._next;
        }
        return count;
    }

    /** Get the total length of the chain this node belongs to */
    length(): number {
        return this.first().lengthToEnd();
    }

    /**
     * Insert a new value before this node.
     * @returns The newly created node
     */
    insertBefore(value: number): LinkedValue {
        const newNode = new LinkedValue(value, this._prev, this);
        return newNode;
    }

    /**
     * Insert a new value after this node.
     * @returns The newly created node
     */
    insertAfter(value: number): LinkedValue {
        const newNode = new LinkedValue(value, this, this._next);
        return newNode;
    }

    /**
     * Remove this node from the chain.
     * @returns The next node (or prev if no next), or null if this was the only node
     */
    remove(): LinkedValue | null {
        const prev = this._prev;
        const next = this._next;

        if (prev) prev._next = next;
        if (next) next._prev = prev;

        this._prev = null;
        this._next = null;

        return next ?? prev;
    }

    /**
     * Split the chain after this node.
     * This node becomes the tail of the first chain.
     * @returns The head of the new chain (was this.next), or null if this was already the tail
     */
    splitAfter(): LinkedValue | null {
        const newHead = this._next;
        if (newHead) {
            newHead._prev = null;
            this._next = null;
        }
        return newHead;
    }

    /**
     * Iterate through all nodes from this one to the end.
     */
    forEach(callback: (node: LinkedValue, index: number) => void): void {
        let node: LinkedValue | null = this; // eslint-disable-line @typescript-eslint/no-this-alias
        let index = 0;
        while (node) {
            callback(node, index);
            node = node._next;
            index++;
        }
    }

    /**
     * Iterate through all nodes from this one to the beginning (reverse).
     */
    forEachReverse(callback: (node: LinkedValue, index: number) => void): void {
        let node: LinkedValue | null = this; // eslint-disable-line @typescript-eslint/no-this-alias
        let index = 0;
        while (node) {
            callback(node, index);
            node = node._prev;
            index++;
        }
    }

    /**
     * Convert the chain to an array of values (from first to last).
     */
    toArray(): number[] {
        const result: number[] = [];
        this.first().forEach(node => result.push(node.value));
        return result;
    }

    /**
     * Find a node in the chain that matches the predicate.
     */
    find(predicate: (value: number) => boolean): LinkedValue | null {
        let node: LinkedValue | null = this.first();
        while (node) {
            if (predicate(node.value)) return node;
            node = node._next;
        }
        return null;
    }

    toString(): string {
        return this.toArray().join(',');
    }
}
