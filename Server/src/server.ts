import fastify from "fastify";
import cors from "@fastify/cors";
import { appRoutes } from "./services/prisma";

const app = fastify();
app.register(appRoutes);
app.register(cors);

app
  .listen({
    port: 3333,
    host: "0.0.0.0",
  })
  .then(() => {
    console.log("Server is running at http://localhost:3333");
  });
