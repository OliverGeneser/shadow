import { FastifyPluginAsync } from "fastify";

const example: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get("/", { websocket: true }, async function (socket, req) {
    socket.on("message", (message) => {
      socket.send("hi from server");
    });
  });
};

export default example;
