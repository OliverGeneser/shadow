import fp from "fastify-plugin";
import WebSocket from "@fastify/websocket";

export default fp(async (fastify) => {
  fastify.register(WebSocket);
});
