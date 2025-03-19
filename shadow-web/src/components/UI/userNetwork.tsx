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

export function UiUserNetwork(props: { me: User; users: User[];onClick:(target:string)=>void }) {
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
    props.onClick(props.users.filter((user) => user.id === node.id)[0].userName);
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
        nodeVal={(node) => (node.id === props.me.id ? 10 : 8)}
        linkColor={() => "rgba(255, 255, 255, 0.7)"}
        linkWidth={1}
        onNodeClick={handleNodeClick}
        enablePanInteraction={false}
        minZoom={5}
        maxZoom={15}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const label = node.userName as string;
          const fontSize = 12 / globalScale;
          const [color, animal] = label.split(" ");
          // Define a color map to convert text to actual color codes
          const colorMap: { [key: string]: string } = {
            Azure: "#007FFF",
            Beige: "#A89C8C",
            Brick: "#CB4154",
            Bronze: "#CD7F32",
            Charcoal: "#36454F",
            Coral: "#FF6F61",
            Cyan: "#00AEEF",
            Emerald: "#50C878",
            Fawn: "#C89B6E",
            Indigo: "#4B0082",
            Jade: "#00A86B",
            Lavender: "#916BBF",
            Maroon: "#800000",
            Olive: "#5A6E41",
            Peach: "#E9967A",
            Rosewood: "#65000B",
            Sapphire: "#0F52BA",
            Teal: "#008080",
            Walnut: "#5D3A1A",
            Amethyst: "#9966CC",
          };

          const circleColor = colorMap[color] || "#3b82f6";

          const avatarSize = node.id === props.me.id ? 10 : 8;
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, avatarSize, 0, 2 * Math.PI, false);
          ctx.fillStyle = circleColor;
          ctx.fill();

          ctx.font = `italic ${fontSize * 0.8}px Sans-Serif`;
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.fillText(`(${color})`, node.x!, node.y! - 2);
          ctx.font = `bold ${fontSize}px Sans-Serif`;
          ctx.fillText(animal, node.x!, node.y! + 1);
        }}
      />
    </div>
  );
}
