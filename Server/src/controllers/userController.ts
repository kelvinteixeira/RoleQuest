import { prisma } from "../lib/prisma";

import { FastifyInstance } from "fastify";

import { z } from "zod";

export async function userController(app: FastifyInstance) {
  app.post("/users", async (req, res) => {
    const newUser = z.object({
      name: z.string(),
      email: z.string(),
      password: z.string(),
      picture: z.string(),
      token: z.string(),
    });
    const { name, email, password, picture, token } = newUser.parse(req.body);

    const userEmail = await prisma.users.findUnique({
      where: {
        email,
      },
    });
    if (userEmail === null) {
      await prisma.users.create({
        data: {
          name,
          email,
          password,
          picture,
          token,
        },
      });
    } else {
      res.status(412).send({ error: "Usuário já cadastrado" });
    }
  });

  app.get("/users", async () => {
    const users = await prisma.users.findMany();
    return users;
  });

  app.patch("/users/:id", async (req) => {
    const userId = z.object({
      id: z.string(),
    });
    const userData = z.object({
      name: z.string(),
      password: z.string(),
      picture: z.string(),
      token: z.string(),
    });
    const { id } = userId.parse(req.params);
    const { name, password, picture, token } = userData.parse(req.body);

    await prisma.users.update({
      where: {
        id,
      },
      data: {
        name,
        password,
        picture,
        token,
      },
    });
  });

  app.delete("/users/:id", async (req) => {
    const userId = z.object({
      id: z.string(),
    });
    const { id } = userId.parse(req.params);

    await prisma.users.delete({
      where: {
        id: id,
      },
    });
  });
}
