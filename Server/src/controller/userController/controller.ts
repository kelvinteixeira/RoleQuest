import { prisma } from './../../lib/prisma';
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { FastifyReply } from "fastify";
import { FastifyRequest } from "fastify";


export async function userController(app: FastifyInstance) {
  app.post("/user", async (req: FastifyRequest, res: FastifyReply) => {
    const newUser = z.object({
      name: z.string(),
      email: z.string(),
      picture: z.string(),
      token: z.string(),
    });
    const {name, email, picture, token} = newUser.parse(req.body);
    await prisma.user.create({
      data:{
        name,
        email,
        picture,
        token
      }
    })

});

}
