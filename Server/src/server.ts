import fastify from "fastify";
import cors from "@fastify/cors";

const app = fastify();

app
  .listen({
    port: 3333,
    host: "0.0.0.0",
  })
  .then(() => {
    console.log("Server is running at http://localhost:3333");
  });

app.get("/", () => {
  return {
    status: "ok",
    code: 200,
  };
});
