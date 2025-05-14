import { useEffect, useRef, useState } from "react";
import ForceGraph2D, { NodeObject } from "react-force-graph-2d";

import {
  store,
  useClientId,
  useClients,
  useSendersAwaitingApproval,
} from "../../stores/connection-store";
import { Client, colorMap } from "shadow-shared";
import Modal from "./modal";

type link = {
  source: string;
  target: string;
};

export function UserNetwork() {
  const boxRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendersAwaitingApproval = useSendersAwaitingApproval();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAcceptTransfer, setShowAcceptTransfer] = useState(false);

  const [selectedNode, setSelectedNode] = useState<Client>();
  const [graphData, setGraphData] = useState<{
    nodes: Client[];
    links: link[];
  }>();

  const clients = useClients();
  const clientId = useClientId();

  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      setWidth(boxRef.current?.clientWidth ?? 0);
      setHeight(boxRef.current?.clientHeight ?? 0);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (sendersAwaitingApproval.length > 0) {
      setShowAcceptTransfer(true);
    } else {
      setShowAcceptTransfer(false);
    }
    console.log("new awaiting approval:", sendersAwaitingApproval);
  }, [sendersAwaitingApproval]);

  useEffect(() => {
    if (!graphRef.current) return;
    graphRef.current.d3Force("charge").strength(-100);
    const collisionForce = graphRef.current.d3Force("collision");
    if (collisionForce) {
      collisionForce
        .radius((node: NodeObject) => (node.clientId === clientId ? 10 : 8))
        .strength(1);
    }
  }, [graphData]);

  useEffect(() => {
    if (!clientId) return;

    console.log("Chganinh");

    setGraphData((prevData) => {
      const prevNodesMap = new Map(
        (prevData?.nodes ?? []).map((n) => [n.clientId, n]),
      );

      const allClients: Client[] = [{ clientId: clientId }, ...(clients ?? [])];

      const nodes = allClients.map((c) => {
        const existing = prevNodesMap.get(c.clientId);
        if (!existing) return { ...c };

        const updated: Client = { ...existing };
        if (c.activity !== existing.activity) {
          updated.activity = c.activity;
        }
        if (c.progress !== existing.progress) {
          updated.progress = c.progress;
        }

        return updated;
      });

      const links =
        clients?.map((c) => ({
          source: clientId,
          target: c.clientId,
        })) ?? [];

      return { nodes, links };
    });
  }, [clients, clientId]);

  const handleNodeClick = (node: NodeObject) => {
    if (node.clientId === clientId) return;

    setSelectedNode(node as Client);

    if (node.activity !== undefined) {
      setShowCancelModal(true);
      return;
    }

    fileInputRef.current?.click();
    store.send({ type: "setupConnection", peerId: node.clientId });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0 && selectedNode) {
      store.send({
        type: "sendFile",
        file: files[0],
        fileId: crypto.randomUUID(),
        peerId: selectedNode.clientId,
      });
    }
  };

  const cancelTransferForNode = (node: Client) => {
    store.trigger.cancelFileTransfer({
      peerId: node.clientId,
    });
    setSelectedNode(undefined);
    setShowCancelModal(false);
  };

  return (
    <div
      className="relative flex h-full w-full items-center justify-center"
      ref={boxRef}
    >
      <input
        type="file"
        className="hidden"
        ref={fileInputRef}
        onClick={(event) => (event.currentTarget.value = "")}
        onChange={handleFileChange}
      />
      {clientId && (
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={width}
          height={height}
          nodeId="clientId"
          nodeVal={(node) => (node.clientId === clientId ? 10 : 8)}
          onNodeClick={handleNodeClick}
          linkColor={() => "rgba(255, 255, 255, 0.7)"}
          linkWidth={1}
          linkCanvasObjectMode="after"
          enablePanInteraction={false}
          enableZoomInteraction={false}
          minZoom={5}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const label = node.clientId ?? "";
            const fontSize = 12 / globalScale;
            const [color, animal] = label.split(" ");
            const circleColor = colorMap[color] || "#3b82f6";
            const avatarSize = node.clientId === clientId ? 10 : 8;

            // Draw node
            ctx.beginPath();
            ctx.arc(node.x!, node.y!, avatarSize, 0, 2 * Math.PI);
            ctx.fillStyle = circleColor;
            ctx.fill();

            // Draw text
            ctx.font = `italic ${fontSize * 0.8}px Sans-Serif`;
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.fillText(`(${color})`, node.x!, node.y! - 2);
            ctx.font = `bold ${fontSize}px Sans-Serif`;
            ctx.fillText(animal, node.x!, node.y! + 1);
            if (node.clientId === clientId) {
              ctx.font = ` ${fontSize * 0.9}px Sans-Serif`;
              ctx.fillText("You", node.x!, node.y! + 6);
            }

            // Indicating ring + progress
            if (node.activity !== undefined && node.clientId !== clientId) {
              const ringRadius = avatarSize + 2.5;

              // indicating circle
              ctx.beginPath();
              ctx.arc(node.x!, node.y!, ringRadius, 0, 2 * Math.PI);
              ctx.strokeStyle =
                node.activity === "pending"
                  ? "#3b82f6"
                  : node.activity === "sending"
                    ? "#22c55e"
                    : "#f97316";
              ctx.lineWidth = 2 / globalScale;
              ctx.stroke();

              if (
                node.activity === "sending" ||
                node.activity === "receiving"
              ) {
                //progress
                const progressRadius = avatarSize + 1.5;

                // Gray background
                ctx.beginPath();
                ctx.arc(node.x!, node.y!, progressRadius, 0, 2 * Math.PI);
                ctx.strokeStyle = "rgba(255,255,255,0.3)";
                ctx.lineWidth = 3 / globalScale;
                ctx.stroke();

                // Blue circle
                ctx.beginPath();
                ctx.arc(
                  node.x!,
                  node.y!,
                  progressRadius,
                  -Math.PI / 2,
                  -Math.PI / 2 + (2 * Math.PI * (node.progress ?? 0)) / 100,
                );
                ctx.strokeStyle = "#3b82f6";
                ctx.lineWidth = 3 / globalScale;
                ctx.stroke();
              }
            }
          }}
        />
      )}
      <Modal text="Cancel process?" isOpen={showCancelModal}>
        <div className="mt-4 flex w-full flex-col gap-4">
          <button
            onClick={() => {
              if (selectedNode) cancelTransferForNode(selectedNode);
            }}
            className="w-full cursor-pointer rounded-xl bg-red-500 px-4 py-2 text-white transition hover:bg-red-600"
          >
            Cancel
          </button>
          <button
            onClick={() => setShowCancelModal(false)}
            className="w-full cursor-pointer rounded-xl bg-green-500 px-4 py-2 text-white transition hover:bg-green-600"
          >
            Close
          </button>
        </div>
      </Modal>
      {sendersAwaitingApproval.map((s) => (
        <Modal
          text="Accept transfer?"
          isOpen={showAcceptTransfer}
          key={s.fileId}
        >
          <div>
            <div className="text-white">
              User {s.peerId ?? ""} wants to send you the following file:{" "}
              {s.fileName}
            </div>
            <div className="mt-4 flex flex-col gap-4">
              <button
                onClick={() => {
                  store.trigger.acceptOrDenyFileTransfer({
                    fileId: s.fileId,
                    accepted: true,
                  });
                }}
                className="cursor-pointer rounded-xl bg-green-500 px-4 py-2 text-white transition hover:bg-green-600"
              >
                Accept
              </button>

              <button
                onClick={() =>
                  store.trigger.acceptOrDenyFileTransfer({
                    fileId: s.fileId,
                    accepted: false,
                  })
                }
                className="cursor-pointer rounded-xl bg-red-500 px-4 py-2 text-white transition hover:bg-red-600"
              >
                Deny
              </button>
            </div>
          </div>
        </Modal>
      ))}
    </div>
  );
}
