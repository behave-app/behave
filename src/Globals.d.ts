declare module "*.module.css";

declare interface Object {
  groupBy<T, K extends string | number | symbol>(
    array: T[],
    getKey: (item: T) => K
  ): Record<K, T[]>;
}

declare interface Iterator<T> {
  forEach(callback: (item: T, index: number) => void): void;
}
