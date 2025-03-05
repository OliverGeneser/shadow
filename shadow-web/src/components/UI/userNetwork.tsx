"use client";
import { useEffect, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";

type User = {
  id: number;
  userName: string;
};

type Link = {
  source: number;
  target: number;
};

export function UiUserNetwork(props: { me: User; users: User[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedNode, setSelectedNode] = useState<User | null>(null);

  const nodes = [
    { id: props.me.id, userName: props.me.userName },
    ...props.users,
  ];
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

  const handleNodeClick = (node: any) => {
    if (node.id === props.me.id) return;
    setSelectedNode(node);
    console.log("Clicked on user ID:", node.id);
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0 && selectedNode) {
      console.log("Selected files:", files);
      console.log("Upload files to user ID:", selectedNode.id);
      // TODO: Handle file upload logic here
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

      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={width}
        height={height}
        nodeLabel={(node: any) => node.userName}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const avatarSize = 8;
          const maxWidth = 15;
          const lineHeight = 12 / globalScale;
          const fontSize = 12 / globalScale;
          const userName = node.userName as string;

          // Draw avatar circle
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, avatarSize, 0, 2 * Math.PI, false);
          ctx.fillStyle = node.id === props.me.id ? "#3b82f6" : "#374151";
          ctx.fill();

          // Set text styles
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";

          // Clip text to prevent overflow
          ctx.save();
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, avatarSize, 0, 2 * Math.PI, false);
          ctx.clip();

          // Wrap text if it exceeds maxWidth
          const words = userName.split(" ");
          let line = "";
          let y = node.y! - ((words.length - 1) * lineHeight) / 2;

          for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + " ";
            const testWidth = ctx.measureText(testLine).width;

            if (testWidth > maxWidth) {
              ctx.fillText(line, node.x!, y);
              line = words[i] + " ";
              y += lineHeight;
            } else {
              line = testLine;
            }
          }
          ctx.fillText(line, node.x!, y);

          ctx.restore();
        }}
        linkColor={() => "rgba(255, 255, 255, 0.7)"}
        linkWidth={1}
        backgroundColor="transparent"
        onNodeClick={handleNodeClick}
        minZoom={5}
        maxZoom={15}
      />
    </div>
  );
}
