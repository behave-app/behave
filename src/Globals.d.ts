declare module "*.module.css";

declare interface Object {
  groupBy<T, K extends string | number | symbol>(
    array: T[],
    getKey: (item: T) => K
  ): Record<K, T[]>;
}

declare interface Window {
  LibAV: LibAVTypes.LibAVWrapper
}
