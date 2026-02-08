// File: ./src/app/component.tsx
"use client";

import * as React from "react";
import { useProvider } from "./page";

export default function Component() {
  const { actions, session, accounts } = useProvider();

  const handleConnect = async () => {
    const response = await actions.connect();
    if (response.error) throw response.error;
    // You have been connected using wallet connect.
    // Now you can start interacting with the XRP Ledger.
    // ...
  };

  const handleDisconnect = async () => {
    await actions.disconnect();
    // You have been connected using wallet connect.
    // Now you can start interacting with the XRP Ledger.
    // ...
  };

  const handleReconnect = async () => {
    const response = await actions.reconnect(session);
    if (response.error) throw response.error;
    // You have been connected using wallet connect.
    // Now you can start interacting with the XRP Ledger.
    // ...
  };

  return (
    <div>
      {!session && (
        <button type="button" onClick={handleConnect}>
          Connect
        </button>
      )}
      {session && (
        <div>
          <span>Successfully connected!</span>
          {accounts &&
            accounts.map((account, index) => <div key={index}>{account}</div>)}
        </div>
      )}
    </div>
  );

  <div>
    {session && (
      <button type="button" onClick={handleDisconnect}>
        Disconnect
      </button>
    )}
  </div>;

  <div>
    <button type="button" onClick={handleReconnect}>
      Reconnect
    </button>
    {session && (
      <div>
        <span>Successfully connected!</span>
        {accounts &&
          accounts.map((account, index) => <div key={index}>{account}</div>)}
      </div>
    )}
  </div>;
}
