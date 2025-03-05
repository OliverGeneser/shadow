import { tv } from "tailwind-variants";

export default tv({
  base: "rounded-lg bg-gray-600 text-white transition duration-150 ease-in-out hover:bg-gray-500",
  variants: {
    color: {
      primary: "bg-gray-600 text-white hover:bg-gray-500",
      secondary: "bg-gray-600 text-white hover:bg-gray-500",
    },
    size: {
      sm: "text-sm",
      md: "text-md",
    },
    padding: {
      none: "p-0",
      some: "p-2",
    },
  },
  defaultVariants: {
    size: "md",
    color: "primary",
    padding: "some",
  },
});
