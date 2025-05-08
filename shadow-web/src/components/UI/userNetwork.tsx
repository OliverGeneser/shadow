"use client";
import { useEffect, useRef, useState } from "react";
import ForceGraph2D, { NodeObject } from "react-force-graph-2d";

import { store, useNewFiles } from "../../stores/connection-store";
import { colorMap } from "shadow-shared";
import Popup from "./popup";

type User = {
  id: number;
  userName: string;
};

type Link = {
  source: number;
  target: number;
};

export function Downloads() {
  const files = useNewFiles();
  return (
    <div>
      {files.map((file) => (
        <a key={file.url} href={file.name} download={file.name}>
          {file.url}
        </a>
      ))}
    </div>
  );
}

export function UserNetwork(props: {
  me: User;
  users: User[];
  onClick: (target: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedNode, setSelectedNode] = useState<User | null>(null);
  const [activeLink, setActiveLink] = useState<Link | null>(null);

  const nodes = [
    { id: props.me.id, userName: props.me.userName },
    ...props.users,
  ];
  // clientId exists
  const links: Link[] = props.users.map((user) => ({
    source: props.me.id,
    target: user.id,
  }));

  const graphData = {
    nodes,
    links,
  };

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
        .radius((node: any) => (node.id === props.me.id ? 10 : 8))
        .strength(1);
    }
  }, [graphData]);

  const handleNodeClick = (node: any) => {
    if (node.id === props.me.id) return;
    setSelectedNode(node);
    console.log("Clicked on user ID:", node.id);
    fileInputRef.current?.click();
    props.onClick(
      props.users.filter((user) => user.id === node.id)[0].userName,
    );
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0 && selectedNode) {
      console.log("Selected files:", files);
      console.log("Upload files to user ID:", selectedNode.id);
      // TODO: Handle file upload logic here
      store.send({
        type: "sendFile",
        file: files[0],
        peerId: selectedNode.userName,
      });
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
      <Downloads />
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={width}
        height={height}
        nodeVal={(node) => (node.id === props.me.id ? 10 : 8)}
        onNodeClick={handleNodeClick}
        enablePanInteraction={false}
        enableZoomInteraction={false}
        minZoom={5}
        onLinkClick={(link, event) => {
          const source = link.source as NodeObject<User>;
          const target = link.target as NodeObject<User>;
          if (!source.x || !source.y || !target.x || !target.y) return;

          const startX = source.x;
          const startY = source.y;
          const endX = target.x;
          const endY = target.y;

          const midX = (startX + endX) / 2;
          const midY = (startY + endY) / 2;

          const dx = endX - startX;
          const dy = endY - startY;
          const angle = Math.atan2(dy, dx);

          const { x: mouseX, y: mouseY } = graphRef.current.screen2GraphCoords(
            event.offsetX,
            event.offsetY,
          );
          const relX = mouseX - midX;
          const relY = mouseY - midY;

          const cos = Math.cos(-angle);
          const sin = Math.sin(-angle);
          const rotatedX = relX * cos - relY * sin;
          const rotatedY = relX * sin + relY * cos;

          const radius = 12;
          const fontSize = 8;
          const circleY = fontSize / 2 + radius;
          const dist = Math.hypot(rotatedX, rotatedY - circleY);

          if (dist <= radius + 6) {
            setActiveLink(link);
          }
        }}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const label = node.userName as string;
          const fontSize = 12 / globalScale;
          const [color, animal] = label.split(" ");

          const circleColor = colorMap[color] || "#3b82f6";
          const avatarSize = node.id === props.me.id ? 10 : 8;
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, avatarSize, 0, 2 * Math.PI);
          ctx.fillStyle = circleColor;
          ctx.fill();

          ctx.font = `italic ${fontSize * 0.8}px Sans-Serif`;
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          if (node.id === props.me.id) {
            ctx.fillText(`(${color})`, node.x!, node.y! - 2);
            ctx.font = ` ${fontSize * 0.9}px Sans-Serif`;
            ctx.fillText("You", node.x!, node.y! + 6);
            ctx.font = `bold ${fontSize}px Sans-Serif`;
            ctx.fillText(animal, node.x!, node.y! + 1);
          } else {
            ctx.fillText(`(${color})`, node.x!, node.y! - 2);
            ctx.font = `bold ${fontSize}px Sans-Serif`;
            ctx.fillText(animal, node.x!, node.y! + 1);
          }
        }}
        linkCanvasObject={(link, ctx, globalScale) => {
          const source = link.source as NodeObject<User>;
          const target = link.target as NodeObject<User>;

          if (
            source.x === undefined ||
            source.y === undefined ||
            target.x === undefined ||
            target.y === undefined
          )
            return;

          const startX = source.x;
          const startY = source.y;
          const endX = target.x;
          const endY = target.y;

          const midX = (startX + endX) / 2;
          const midY = (startY + endY) / 2;

          const dx = endX - startX;
          const dy = endY - startY;
          const angle = Math.atan2(dy, dx);

          const progress = link.progress ?? 100;

          ctx.save();

          // Draw the line
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
          ctx.lineWidth = 0.5;
          ctx.stroke();

          ctx.translate(midX, midY);
          ctx.rotate(angle);

          // Flip
          if (Math.abs(angle) > Math.PI / 2) {
            ctx.rotate(Math.PI);
          }

          const fontSize = Math.max(8 / globalScale, 2);
          const offset = 12 / globalScale;
          const radius = 12 / globalScale;
          const circleY = fontSize / 2 + radius;

          // underlying circle
          ctx.beginPath();
          ctx.arc(0, circleY, radius, 0, 2 * Math.PI);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
          ctx.lineWidth = 4 / globalScale;
          ctx.stroke();

          // top circle
          ctx.beginPath();
          ctx.arc(
            0,
            circleY,
            radius,
            -Math.PI / 2,
            -Math.PI / 2 + (2 * Math.PI * progress) / 100,
          );
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 4 / globalScale;
          ctx.stroke();

          // percentage text
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(`${progress}%`, 0, offset);

          ctx.restore();
        }}
      />
      <Popup text="Cancel process?" isOpen={activeLink ? true : false}>
        <button
          onClick={() => {
            console.log("sss");
            setActiveLink(null);
          }}
          className="cursor-pointer rounded-xl bg-red-500 px-4 py-2 text-white transition hover:bg-red-600"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            console.log("s");
            setActiveLink(null);
          }}
          className="cursor-pointer rounded-xl bg-green-500 px-4 py-2 text-white transition hover:bg-green-600"
        >
          Close
        </button>
      </Popup>
    </div>
  );
}
