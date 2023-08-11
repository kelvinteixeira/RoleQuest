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
    try {
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
        res.status(412).send({ error: "Esse email já está sendo usado!" });
      }
    } catch {
      res
        .status(422)
        .send({
          error:
            "Erro de validação: os dados fornecidos são inválidos ou não atendem aos requisitos",
        });
    }
  });

  app.get("/users", async (req , res ) => {
    try {
      const user = await prisma.users.findMany();
      return user;
    } catch {
      res
        .status(400)
        .send({
          error:
            "Solicitação inválida: os parâmetros fornecidos não estão corretos.",
        });
    }
  });

  app.patch("/users/:id", async (req, res) => {
    const userId = z.object({
      id: z.string(),
    });
    const userData = z.object({
      name: z.string(),
      password: z.string(),
      picture: z.string(),
      token: z.string(),
      
    });
    try {
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
    } catch {
      res
        .status(422)
        .send({
          error:
            "Erro ao atualizar usuário: os dados fornecidos estão incorretos!",
        });
    }
  });

  app.delete("/users/:id", async (req, res) => {
    try {
      const userId = z.object({
        id: z.string(),
      });
      const { id } = userId.parse(req.params);

       await prisma.users.delete({
        where: {
          id: id,
        },
      });
     
    } catch {
      res
        .status(404)
        .send({
          error: "Erro ao excluir usuário: o usuário não foi encontrado.",
        });
    }
  });
}
