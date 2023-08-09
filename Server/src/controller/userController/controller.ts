import { User } from './../../../../Web/src/redux/auth/authTypes';
import { prisma } from "./../../lib/prisma";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { FastifyReply } from "fastify";
import { FastifyRequest } from "fastify";
import { request } from 'http';

export async function userController(app: FastifyInstance) {
  app.post("/user", async (req: FastifyRequest, res: FastifyReply) => {
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
      res.status(412).send({ error: "usuário ja existe" });
    }
  });
 
 app.get("/user", async (req: FastifyRequest, rep: FastifyReply) => {
   const user = await prisma.users.findMany();
   return user;
 });

  app.patch("/user/:id", async (req: FastifyRequest,rep: FastifyReply) => {
    const userId = z.object({
      id : z.string(),
    });
    const userData = z.object({
      name   :z.string(),
      password: z.string(),
      picture: z.string(),
      token: z.string()
    })
    const {id} = userId.parse(req.params);
    const {name, password, picture, token} = userData.parse(req.body);

    await prisma.users.update({
      where : {
        id, 
      },
      data:{
        name,
        password,
        picture,
        token
      }
    })
    
  })

    app.delete("/user/:id", async (req: FastifyRequest, rep: FastifyReply) => {
      const userId = z.object({
        id: z.string(),
      });
      const { id } = userId.parse(req.params);
  
      const user = await prisma.users.delete({
        where: {
          id: id,
        },
      });
      return user;
    });
    

}


