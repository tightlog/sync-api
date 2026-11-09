export type EnvContract<
  Generated,
  Declared,
  Extra extends PropertyKey = never,
> = [Exclude<keyof Generated, keyof Declared | Extra>] extends [never]
  ? true
  : {
      bindingsMissingFromEnvType: Exclude<
        keyof Generated,
        keyof Declared | Extra
      >;
    };
