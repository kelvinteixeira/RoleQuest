import fastify from "fastify";
import cors from "@fastify/cors";
import { userController } from "./controller/userController/controller";
const app = fastify();

app.register(cors);

app.register(cors, {
  origin: true,
});

app.register(userController);

app
  .listen({
    port: 3333,
    host: "0.0.0.0",
  })
  .then(() => {
    console.log("Server is running at http://localhost:3333");
  });
