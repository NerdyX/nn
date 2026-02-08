import {
  DeviceActionStatus,
  UserInteractionRequired,
  InstallAppDAState,
  InstallAppDeviceAction,
} from "@ledgerhq/device-management-kit";

const deviceAction = new InstallAppDeviceAction({
  input: { unlockTimeout: 60000, appName: "Solana" },
});

const { observable, cancel } = await dmk.executeDeviceAction({
  deviceAction,
});

observable.subscribe({
  next: (state: InstallAppDAState) => {
    switch (state.status) {
      case DeviceActionStatus.Pending:
        const {
          intermediateValue: { requiredUserInteraction, progress },
        } = state;
        switch (requiredUserInteraction) {
          case UserInteractionRequired.None:
            console.log(
              `Installing app progress ${progress}, no user action required`,
            );
            break;
          case UserInteractionRequired.AllowSecureConnection:
            console.log(
              "User should allow the secure connection on the device",
            );
            break;
          case UserInteractionRequired.UnlockDevice:
            console.log("User should unlock the device");
            break;
          default:
            throw new Error("Unknown user interaction required");
        }
        break;
      case DeviceActionStatus.Completed:
        const { output } = state;
        console.log("Device action completed", output);
        break;
      case DeviceActionStatus.Error:
        const { error } = state;
        console.log("Error occurred during the execution", error);
        break;
    }
  },
});
