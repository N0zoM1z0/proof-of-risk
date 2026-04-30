import { createProofServer } from "./app";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const host = process.env.HOST ?? "127.0.0.1";
const server = createProofServer();

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
