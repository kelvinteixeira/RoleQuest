import { prisma } from "../lib/prisma";
import { FastifyInstance } from "fastify";
import { z } from "zod";

export async function appRoutes(app: FastifyInstance) {
  // const post = await prisma.teste.create({
  //   data: {
  //     name: "dsa",
  //     email: "@asd",
  //     password: "asd",
  //   },
  // });
  // console.log(post)
  // return post

  app.post("/users", async (request) => {
    const user = z.object({
      name: z.string(),
      email: z.string(),
      password: z.string(),
    });
    const { name, email, password } = user.parse(request.body);
    await prisma.teste.create({
      data: {
        name,
        email,
        password,
      },
    });
  });

  // app.get("/users", async (request) => {
  //   const users = await prisma.users.findMany();
  //   return users;
  // });
}
