import { useEffect, useRef, useState } from "react";
import ForceGraph2D, { NodeObject } from "react-force-graph-2d";

import { store, useClientId, useClients } from "../../stores/connection-store";
import { Client, colorMap } from "shadow-shared";
import Popup from "./popup";

export function UserNetwork() {
  const boxRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedNode, setSelectedNode] = useState<Client | undefined>(
    undefined,
  );

  const clients = useClients();
  const client = useClientId();

  const me = { id: 0, userName: client };

  const nodes = [
    { id: me.id, userName: me.userName },
    ...(clients.map((client, index) => ({
      id: index + 1,
      userName: client.clientId,
    })) ?? []),
  ];
  const links =
    clients.map((_, index) => ({
      source: me.id,
      target: index + 1,
    })) ?? [];

  const graphData = { nodes, links };
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
    if (!graphRef.current) return;
    graphRef.current.d3Force("charge").strength(-100);
    const collisionForce = graphRef.current.d3Force("collision");
    if (collisionForce) {
      collisionForce
        .radius((node: any) => (node.id === me.id ? 10 : 8))
        .strength(1);
    }
  }, [graphData]);

  const handleNodeClick = (node: NodeObject) => {
    if (node.id === me.id) return;
    setSelectedNode(
      clients.find((client) => client.clientId === node.userName),
    );

    if (node.activity !== undefined) {
      //cancel for this node/user
      console.log("Clicked active transfer user ID:", node.id);
      return;
    }

    console.log("Clicked user ID:", node.id);
    console.log("Clicked user ID:", node);
    fileInputRef.current?.click();
    store.send({ type: "setupConnection", peerId: node.userName });
    //set node/user to pending

    // props.onClick(users.find((user) => user.id === node.id)!.userName);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0 && selectedNode) {
      console.log("Selected files:", files);
      console.log("Upload files to user ID:", selectedNode.clientId);
      // TODO: Handle file upload logic here

      store.send({
        type: "sendFile",
        file: files[0],
        peerId: selectedNode.clientId,
      });
      //set node/user to sending
    }
  };

  const cancelTransferForNode = (node: NodeObject) => {
    if (node.activity !== undefined) {
      console.log("Canceling transfer for user ID:", node.id);
      //set node/user activity to undefined
    }
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
        onChange={handleFileChange}
        multiple
      />
      {client ? (
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={width}
          height={height}
          nodeVal={(node) => (node.id === me.id ? 10 : 8)}
          onNodeClick={handleNodeClick}
          linkColor={() => "rgba(255, 255, 255, 0.7)"}
          linkWidth={1}
          linkCanvasObjectMode="after"
          enablePanInteraction={false}
          enableZoomInteraction={false}
          minZoom={5}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const label = node.userName ?? "";
            const fontSize = 12 / globalScale;
            const [color, animal] = label.split(" ");
            const circleColor = colorMap[color] || "#3b82f6";
            const avatarSize = node.id === me.id ? 10 : 8;

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
            if (node.id === me.id) {
              ctx.font = ` ${fontSize * 0.9}px Sans-Serif`;
              ctx.fillText("You", node.x!, node.y! + 6);
            }

            // Indicating ring + progress
            if (node.activity !== undefined && node.id !== me.id) {
              const ringRadius = avatarSize + 2.5;

              // indicating circle
              ctx.beginPath();
              ctx.arc(node.x!, node.y!, ringRadius, 0, 2 * Math.PI);
              ctx.strokeStyle =
                node.activity === "sending" ? "#22c55e" : "#f97316";
              ctx.lineWidth = 2 / globalScale;
              ctx.stroke();

              if (node.activity === "sending" || node.activity === "reiving") {
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
                  -Math.PI / 2 + (2 * Math.PI * node.progress) / 100,
                );
                ctx.strokeStyle = "#3b82f6";
                ctx.lineWidth = 3 / globalScale;
                ctx.stroke();
              }
            }
          }}
        />
      ) : null}
      <Popup
        text="Cancel process?"
        isOpen={selectedNode?.activity !== undefined}
      >
        <button
          onClick={() => {
            if (selectedNode) cancelTransferForNode(selectedNode);
            setSelectedNode(undefined);
          }}
          className="cursor-pointer rounded-xl bg-red-500 px-4 py-2 text-white transition hover:bg-red-600"
        >
          Cancel
        </button>
        <button
          onClick={() => setSelectedNode(undefined)}
          className="cursor-pointer rounded-xl bg-green-500 px-4 py-2 text-white transition hover:bg-green-600"
        >
          Close
        </button>
      </Popup>
    </div>
  );
}
