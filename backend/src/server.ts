import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { initSocketServer } from "./sockets/io";
import { startOverdueScheduler } from "./jobs/overdueTaskJob";

const app = createApp();
const httpServer = http.createServer(app);

initSocketServer(httpServer);
startOverdueScheduler();

httpServer.listen(env.port, () => {
  console.log(`Velozity API listening on port ${env.port} (${env.nodeEnv})`);
});
