type PromiseType<T> = T extends Promise<infer U> ? U : never;

export default PromiseType;
