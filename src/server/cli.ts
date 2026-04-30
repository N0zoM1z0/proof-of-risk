import { createProofHttpServer, createProofServerContext } from "./app";
import { attachRoomWebSocketProtocol } from "./ws";
import { JsonFileAppDatabase } from "../persistence";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const host = process.env.HOST ?? "127.0.0.1";
const storage = process.env.PROOF_DB_FILE ? new JsonFileAppDatabase(process.env.PROOF_DB_FILE) : undefined;
const context = createProofServerContext({ storage });
const server = createProofHttpServer(context);
attachRoomWebSocketProtocol(server, context);

server.listen(port, host, () => {
  console.log(
    JSON.stringify({
      service: "proof-of-risk-server",
      status: "listening",
      host,
      port
    })
  );
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
