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

export function UiUserNetwork({ me, users }: { me: User; users: User[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedNode, setSelectedNode] = useState<User | null>(null);

  const nodes = [{ id: me.id, userName: me.userName }, ...users];
  const links: Link[] = users.map((user) => ({
    source: me.id,
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
      className="relative w-full h-full flex items-center justify-center"
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
          const avatarSize = 5;
          const fontSize = 12 / globalScale;
          const userName = node.userName as string;

          // Draw avatar circle
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, avatarSize, 0, 2 * Math.PI, false);
          ctx.fillStyle = node.id === me.id ? "#3b82f6" : "#374151"; // Blue for me, gray for others
          ctx.fill();

          // Draw user name inside avatar
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.fillText(userName, node.x!, node.y! + fontSize / 2);
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
