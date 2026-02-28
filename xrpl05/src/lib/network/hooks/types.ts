export interface HookDefinition {
  HookHash: string;
  HookNamespace: string;
  HookOn: string;
  HookParameters: {
    HookParameter: {
      HookParameterName: string;
      HookParameterValue: string;
    }
  }[];
  HookApiVersion: number;
}

export interface HookExecution {
  HookReturnCode: string;
  HookReturnString: string;
  HookStateChanges: any[];
}
