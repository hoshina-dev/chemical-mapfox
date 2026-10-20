// Local test accounts and ticketing double; catalogue data uses the real API.
import { addUser, resetDb } from "../features/support/fixtures.js";
import { resetStubs } from "../features/support/stub/registry.js";
import {
  startStubServer,
  stopStubServer,
} from "../features/support/stub/server.js";

await startStubServer(3100, "0.0.0.0");
resetDb();
resetStubs();
addUser({
  name: "Catalogue Admin",
  email: "admin@example.com",
  password: "password123",
  role: "admin",
});
addUser({
  name: "Catalogue Client",
  email: "client@example.com",
  password: "password123",
  role: "user",
});
console.log("Local test account and ticketing services listening on port 3100");
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, async () => {
    await stopStubServer();
    process.exit(0);
  });
}
